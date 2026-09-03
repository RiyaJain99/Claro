"""
AI ENGINE — Email Classification & Reply Generation using Groq + Llama 3.1

CORE CONCEPT: Why LLM Classification instead of ML/Rules?

1. RULE-BASED (Gmail's old approach):
   if "unsubscribe" in body: category = "Promotion"
   Problem: Brittle. "Please unsubscribe me from this committee" would misclassify.

2. TRADITIONAL ML (Naive Bayes, SVM):
   Train on labeled dataset → predict category
   Problem: Needs thousands of labeled examples. Can't understand context.
   Gmail uses this for spam detection — very effective at scale.

3. LLM-BASED (our approach):
   Send email to LLM, ask for structured JSON output
   Advantage: Understands nuance, context, intent. Zero training data needed.
   Disadvantage: Higher latency (~500ms vs ~5ms), higher cost per call.

4. HYBRID (Superhuman, Hey.com):
   Use rules to pre-filter obvious spam/newsletters,
   then LLM for the ambiguous, high-value emails.
   Best of both worlds — we'll add this in a later phase.

INTERVIEW QUESTION: "How do confidence scores work?"
ANSWER: We ask the LLM to self-report confidence as part of its structured output.
This is called "verbalized confidence" or "calibrated uncertainty". 
It's not mathematically rigorous like softmax probabilities from a classification head,
but it's surprisingly useful for prioritization. Research shows GPT-4 class models
are well-calibrated (high confidence = actually correct ~85% of the time).
"""

import json
import os
import re
import time
from typing import Dict, Any, Optional

from groq import Groq, RateLimitError
from dotenv import load_dotenv

load_dotenv()

RATE_LIMIT_MAX_RETRIES = 5
RATE_LIMIT_BASE_DELAY = 3.0  # seconds, doubles each retry (capped below)
RATE_LIMIT_MAX_DELAY = 30.0


def _create_completion_with_retry(client: Groq, **kwargs):
    """
    Call Groq's chat completion, retrying on 429 rate limits with backoff.

    Groq's free tier has a low requests-per-minute cap, easily hit when
    classifying a batch of emails back-to-back. We honor the API's
    Retry-After header when present, otherwise fall back to exponential
    backoff (2s, 4s, 8s).
    """
    for attempt in range(RATE_LIMIT_MAX_RETRIES + 1):
        try:
            return client.chat.completions.create(**kwargs)
        except RateLimitError as e:
            if attempt == RATE_LIMIT_MAX_RETRIES:
                raise
            retry_after = e.response.headers.get("retry-after")
            delay = float(retry_after) if retry_after else min(RATE_LIMIT_BASE_DELAY * (2 ** attempt), RATE_LIMIT_MAX_DELAY)
            print(f"[AI] Rate limited by Groq, retrying in {delay:.1f}s (attempt {attempt + 1}/{RATE_LIMIT_MAX_RETRIES})")
            time.sleep(delay)

# ─── Category Definitions ─────────────────────────────────────────────────────
# We define categories with descriptions so the LLM understands intent,
# not just labels. This is called "label description" prompting and
# significantly improves classification accuracy.

CATEGORIES = {
    # Career / Placement (most important for a CSE student!)
    "Job Application": "Confirmation of job/internship application, interview calls, offer letters, rejection emails",
    "Recruiter Outreach": "Recruiters or HR reaching out about job openings, LinkedIn InMail forwarded to email",
    "Internship": "Internship opportunities, intern program announcements, stipend/joining details",
    "Placement & Campus": "TPO emails, campus placement drives, pre-placement offers (PPO), placement eligibility",
    
    # Academic
    "Academic": "Professor emails, assignment deadlines, exam schedules, university circulars, marks/grades",
    
    # Finance
    "Finance & Banking": "Bank statements, salary credits, UPI transactions, loan/EMI alerts, income tax",
    "Bills & Payments": "Electricity/water/internet bills, subscription renewals, payment confirmations",
    
    # Communication
    "Personal": "Emails from friends, family, personal contacts — informal tone",
    "Requires Reply": "Any email that explicitly asks a question or requests an action from you",
    "Follow Up Required": "Emails you sent that need a follow-up, or chains awaiting your response",
    
    # High priority catch-all
    "High Priority": "Deadlines within 24-48 hours, urgent requests, critical alerts, security notices",
    
    # Low value
    "Newsletter": "Weekly/monthly email digests, blog updates, product changelog emails",
    "Promotions": "Discount codes, sale announcements, marketing emails from brands",
    "Social": "LinkedIn notifications, GitHub notifications, Twitter/Instagram email digests",
    "Travel": "Flight booking confirmations, hotel reservations, cab booking receipts",
    "Shopping": "Order confirmations, delivery updates, return/refund status from e-commerce",
    "Spam": "Obvious spam, phishing attempts, suspicious links, lottery/prize scams",
    "General": "Doesn't fit any specific category — miscellaneous correspondence",
}

CATEGORY_LIST = list(CATEGORIES.keys())

# Hybrid pre-filter: obvious patterns skip the LLM (~5ms vs ~500ms).
RULE_PATTERNS: list[tuple[re.Pattern[str], str, str, float]] = [
    (re.compile(r"unsubscribe|view in browser|email preferences|manage subscriptions", re.I), "Newsletter", "Low", 0.92),
    (re.compile(r"(\d+% off|limited time offer|shop now|sale ends|promo code|flash sale)", re.I), "Promotions", "Low", 0.90),
    (re.compile(r"(won the lottery|claim your prize|wire transfer|nigerian prince|verify your account immediately)", re.I), "Spam", "Low", 0.95),
    (re.compile(r"(linkedin.*(commented|liked|mentioned|connection request)|github.*(opened|merged|commented))", re.I), "Social", "Low", 0.88),
    (re.compile(r"(flight confirmation|boarding pass|hotel reservation|check-in reminder|itinerary)", re.I), "Travel", "Low", 0.85),
    (re.compile(r"(order confirmed|shipped|out for delivery|tracking number|return label)", re.I), "Shopping", "Low", 0.87),
    (re.compile(r"(invoice|payment due|billing statement|amount due|overdue notice)", re.I), "Bills & Payments", "Medium", 0.82),
]


def try_rule_based_classification(
    subject: str,
    sender: str,
    snippet: str,
    body: str,
) -> Optional[Dict[str, Any]]:
    """Return a classification dict when rules match confidently, else None."""
    text = f"{subject} {sender} {snippet} {body[:800]}"
    for pattern, category, priority, confidence in RULE_PATTERNS:
        if pattern.search(text):
            return {
                "category": category,
                "priority": priority,
                "confidence": confidence,
                "summary": f"Rule-based match: likely {category.lower()} email.",
                "suggestion": "Low urgency — review when convenient." if priority == "Low" else "Review and respond if needed.",
                "requires_reply": False,
                "follow_up_needed": False,
                "_source": "rule",
            }
    return None


def get_groq_client() -> Groq:
    """Return authenticated Groq client. Raises clear error if key is missing."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "GROQ_API_KEY is not set. Add it to your .env file. "
            "Get a free key at console.groq.com"
        )
    return Groq(api_key=api_key)


def classify_email(
    subject: str,
    sender: str,
    snippet: str,
    body: str,
    feedback_examples: Optional[list] = None,
) -> Dict[str, Any]:
    """
    Classify an email using LLM. Returns structured analysis.

    PROMPT ENGINEERING DECISIONS:
    1. System prompt establishes the model as an expert — sets the "persona"
    2. We list ALL categories with descriptions — this is "label prompting"
    3. We use response_format=json_object to guarantee valid JSON output
    4. temperature=0.1 makes output deterministic (classification, not creative writing)
    5. We cap body at 2000 chars — most classification signal is in subject + first paragraph

    STRUCTURED OUTPUT:
    We tell the model EXACTLY what JSON keys to return and what values are valid.
    This is called "constrained generation" — eliminates JSON parsing errors.

    HUMAN-IN-THE-LOOP IMPROVEMENT:
    feedback_examples (optional) is a list of dicts with keys
    {subject, sender, snippet, corrected_category} pulled from the
    classification_feedback table — real corrections the user made on
    past emails. We inject these as few-shot examples so the model learns
    the user's personal labeling preferences WITHOUT any fine-tuning or
    retraining. This is the standard "in-context learning" pattern used
    by production LLM systems (e.g. Gmail Smart Labels' early iterations).
    """
    rule_result = try_rule_based_classification(subject, sender, snippet, body)
    if rule_result:
        return rule_result

    try:
        client = get_groq_client()
    except EnvironmentError as e:
        return _fallback_result(str(e))

    category_descriptions = "\n".join(
        f'  - "{cat}": {desc}' for cat, desc in CATEGORIES.items()
    )

    few_shot_block = ""
    if feedback_examples:
        example_lines = []
        for ex in feedback_examples[:5]:  # cap at 5 most recent corrections
            ex_subject = ex.get("subject", "")[:80]
            ex_sender = ex.get("sender", "")[:50]
            ex_category = ex.get("corrected_category", "")
            example_lines.append(
                '  Email: subject="{0}", sender="{1}" -> correct category is "{2}"'.format(
                    ex_subject, ex_sender, ex_category
                )
            )
        examples_text = "\n".join(example_lines)
        few_shot_block = (
            "\n\nThe user has previously corrected the AI on these similar emails. "
            "Use these corrections to calibrate your classification:\n"
            + examples_text + "\n"
        )

    system_prompt = f"""You are an expert email classifier for a smart inbox AI assistant.

Analyze the email and return a JSON object with EXACTLY these fields:

{{
  "category": "<one of the exact category names listed below>",
  "priority": "<exactly one of: High, Medium, Low>",
  "confidence": <float between 0.0 and 1.0>,
  "summary": "<one sentence summarizing what this email is about>",
  "suggestion": "<one sentence on what the user should do — be specific>",
  "requires_reply": <true or false>,
  "follow_up_needed": <true or false>
}}

VALID CATEGORIES (pick the single best fit):
{category_descriptions}

PRIORITY RULES:
- High: Action needed within 24-48h, deadlines, urgent requests, job offers, security alerts
- Medium: Action needed this week, meeting requests, questions requiring answers
- Low: FYI only, newsletters, promotions, no action required

CONFIDENCE: Your honest estimate of how certain you are about the category (0.0-1.0).
Use >0.85 only when the category is obvious. Use 0.5-0.7 when ambiguous.

REQUIRES_REPLY: true if the sender is waiting for a response from the user.
FOLLOW_UP_NEEDED: true if the user sent something earlier and hasn't heard back.

Return ONLY the JSON object. No markdown, no explanation, no extra text.{few_shot_block}"""

    user_prompt = (
        f"From: {sender}\n"
        f"Subject: {subject}\n"
        f"Preview: {snippet}\n"
        f"Body:\n{body[:2000]}"
    )

    try:
        response = _create_completion_with_retry(
            client,
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1,      # Low temp = consistent, deterministic output
            max_tokens=500,       # gpt-oss is a reasoning model - budget covers
            reasoning_effort="low",  # reasoning tokens too, not just the answer
        )

        raw = response.choices[0].message.content
        result = json.loads(raw)

        # Validate and sanitize the response
        return _sanitize_classification(result)

    except json.JSONDecodeError as e:
        print(f"[AI] JSON parse error: {e}")
        return _fallback_result("AI returned malformed JSON")
    except Exception as e:
        print(f"[AI] Groq API error: {e}")
        return _fallback_result(f"API error: {str(e)[:100]}")


def generate_reply_draft(
    subject: str,
    sender: str,
    body: str,
    instructions: Optional[str] = None
) -> str:
    """
    Generate a professional email reply draft.

    PROMPT ENGINEERING NOTES:
    - temperature=0.7 gives creative variation (good for writing, bad for classification)
    - We explicitly ban hallucination: "never invent facts"
    - We ask for a specific word count to prevent rambling
    - The system prompt sets a professional persona
    """
    try:
        client = get_groq_client()
    except EnvironmentError as e:
        return f"[Error] {e}"

    instruction_text = instructions or (
        "Write a polite, professional reply. "
        "Never invent facts. Ask for clarification if needed. "
        "Keep it under 120 words."
    )

    system_prompt = (
        "You are a professional email assistant. "
        "Write ONLY the reply body — no Subject, no To/From headers. "
        "Include a professional greeting (e.g., 'Hi [Name],') and a sign-off "
        "ending with '[Your Name]'. "
        "Be concise, clear, and professional. "
        "Never make up facts, dates, or details not in the original email. "
        "If information is missing, politely ask for it."
    )

    user_prompt = (
        f"Original Email\n"
        f"From: {sender}\n"
        f"Subject: {subject}\n"
        f"---\n"
        f"{body[:2500]}\n"
        f"---\n"
        f"Instructions: {instruction_text}"
    )

    try:
        response = _create_completion_with_retry(
            client,
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=900,       # gpt-oss is a reasoning model - budget covers
            reasoning_effort="low",  # reasoning tokens too, not just the answer
        )
        text = (response.choices[0].message.content or "").strip()
        if not text:
            return "[Draft generation failed] Model returned an empty response - try regenerating."
        return text
    except Exception as e:
        return f"[Draft generation failed] {str(e)}"


# ─── Private Helpers ──────────────────────────────────────────────────────────

def _sanitize_classification(result: Dict) -> Dict[str, Any]:
    """
    Validate and clean the LLM's JSON response.
    
    WHY: LLMs sometimes return valid JSON but with unexpected values
    (e.g., priority = "URGENT" instead of "High").
    Sanitization makes our system robust to model variations.
    """
    # Ensure category is one of our known categories
    category = result.get("category", "General")
    if category not in CATEGORY_LIST:
        # Try to fuzzy-match common variations
        category_lower = category.lower()
        matched = next(
            (c for c in CATEGORY_LIST if c.lower() in category_lower or category_lower in c.lower()),
            "General"
        )
        category = matched

    # Normalize priority
    priority = result.get("priority", "Medium")
    if priority not in ("High", "Medium", "Low"):
        priority_map = {"high": "High", "medium": "Medium", "low": "Low", 
                        "urgent": "High", "normal": "Medium", "critical": "High"}
        priority = priority_map.get(priority.lower(), "Medium")

    # Clamp confidence to [0, 1]
    confidence = float(result.get("confidence", 0.75))
    confidence = max(0.0, min(1.0, confidence))

    return {
        "category": category,
        "priority": priority,
        "confidence": round(confidence, 2),
        "summary": str(result.get("summary", ""))[:300],
        "suggestion": str(result.get("suggestion", ""))[:300],
        "requires_reply": bool(result.get("requires_reply", False)),
        "follow_up_needed": bool(result.get("follow_up_needed", False)),
    }


def _fallback_result(error_msg: str) -> Dict[str, Any]:
    """Return a safe default when AI is unavailable."""
    return {
        "category": "General",
        "priority": "Medium",
        "confidence": 0.0,
        "summary": f"Could not analyze: {error_msg}",
        "suggestion": "Read the email manually and respond if needed.",
        "requires_reply": False,
        "follow_up_needed": False,
    }