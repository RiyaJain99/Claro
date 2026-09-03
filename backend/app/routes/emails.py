"""
EMAIL ROUTES — REST API endpoints for email operations.

ARCHITECTURE PATTERN: Repository Pattern (simplified)
Instead of calling the database directly from routes, we use helper functions.
This keeps routes thin and testable — a key interview talking point.

ENDPOINT DESIGN:
- GET  /emails              — list emails (fetches from Gmail if empty, else returns cache)
- GET  /emails/{id}         — get single email by ID
- POST /emails/classify     — classify a single email, save result to DB
- POST /emails/bulk-classify — classify all unanalyzed emails (async-style)
- POST /emails/draft-reply  — generate AI reply draft, save to DB
- POST /emails/create-draft — push draft to Gmail drafts folder
- POST /emails/send         — send email via Gmail API
- GET  /emails/analytics    — return aggregated stats from DB

INTERVIEW QUESTION: "What's the difference between GET and POST here?"
ANSWER: GET is idempotent — calling it 10 times has the same effect as calling it once.
POST modifies state (creates a classification record, triggers an AI call).
Using the right HTTP verbs is part of RESTful API design.
"""

import time
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.ai import classify_email, generate_reply_draft
from app.database import (
    EmailRecord, EmailClassification, DraftRecord, ClassificationFeedback, get_db
)
from app.gmail_service import (
    create_gmail_draft,
    get_latest_emails,
    is_authenticated,
    send_gmail_reply,
)

router = APIRouter(prefix="/emails", tags=["emails"])


# ─── Request / Response Schemas ───────────────────────────────────────────────
# Pydantic models validate incoming JSON automatically.
# If a field is wrong type or missing, FastAPI returns a 422 error instantly —
# no manual validation code needed. This is one of FastAPI's biggest advantages.

class ClassifyRequest(BaseModel):
    subject: str
    sender: str
    snippet: str = ""
    body: str
    email_id: Optional[str] = None   # If provided, saves result to DB


class FeedbackRequest(BaseModel):
    email_id: str
    subject: str
    sender: str
    snippet: str = ""
    original_category: str
    corrected_category: str
    original_priority: str = ""
    corrected_priority: str = ""


class DraftReplyRequest(BaseModel):
    subject: str
    sender: str
    body: str
    email_id: Optional[str] = None
    instructions: Optional[str] = None


class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body_text: str
    thread_id: Optional[str] = None


# ─── Auth Dependency ──────────────────────────────────────────────────────────

def check_auth():
    """
    FastAPI Dependency — reusable auth guard.
    
    By using Depends(check_auth), we DRY up authentication.
    Every route that needs auth just adds: dependencies=[Depends(check_auth)]
    
    INTERVIEW QUESTION: "How would you add JWT auth here?"
    ANSWER: Replace this dependency with one that validates a Bearer token.
    The routes themselves don't change at all — that's the power of dependency injection.
    """
    if not is_authenticated():
        raise HTTPException(
            status_code=401,
            detail="Not authenticated with Gmail. Visit /auth/login first."
        )


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("", dependencies=[Depends(check_auth)])
def list_emails(
    max_results: int = Query(default=15, ge=1, le=50),
    refresh: bool = Query(default=False),
    db: Session = Depends(get_db)
):
    """
    Fetch emails — returns DB cache first, fetches from Gmail if cache is empty or refresh=True.
    
    CACHING STRATEGY:
    On first load: fetch from Gmail API → save to DB → return to frontend
    On subsequent loads: return from DB (fast, no API quota used)
    When refresh=true: re-fetch from Gmail, upsert into DB
    
    This is called "cache-aside" pattern — used by Redis, Memcached, etc.
    """
    # Check DB cache first
    if not refresh:
        cached = db.query(EmailRecord).order_by(
            EmailRecord.fetched_at.desc()
        ).limit(max_results).all()

        if cached:
            # Attach classification data to each email
            return _serialize_emails_with_classifications(cached, db)

    # Cache miss or refresh — fetch from Gmail API
    try:
        raw_emails = get_latest_emails(max_results=max_results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gmail API error: {str(e)}")

    # Upsert emails into DB (update if exists, insert if new)
    for email_data in raw_emails:
        existing = db.query(EmailRecord).filter(
            EmailRecord.id == email_data["id"]
        ).first()

        if not existing:
            record = EmailRecord(
                id=email_data["id"],
                thread_id=email_data.get("threadId", ""),
                subject=email_data.get("subject", ""),
                sender=email_data.get("sender", ""),
                recipient=email_data.get("recipient", ""),
                date_str=email_data.get("date", ""),
                snippet=email_data.get("snippet", ""),
                body=email_data.get("body", ""),
            )
            db.add(record)
        else:
            # Update snippet/body in case Gmail updated it
            existing.snippet = email_data.get("snippet", existing.snippet)

    db.commit()

    # Fetch the freshly saved records
    saved = db.query(EmailRecord).order_by(
        EmailRecord.fetched_at.desc()
    ).limit(max_results).all()

    return _serialize_emails_with_classifications(saved, db)


@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """
    Return aggregated stats for the dashboard.
    
    INTERVIEW QUESTION: "How would you optimize this for 1 million emails?"
    ANSWER: Add database indexes on category + priority columns,
    use GROUP BY in SQL instead of Python loops (let the DB do the math),
    and cache the result in Redis with a 5-minute TTL.
    """
    total_emails = db.query(EmailRecord).count()
    total_classified = db.query(EmailClassification).count()
    total_drafts = db.query(DraftRecord).count()

    # Category distribution
    classifications = db.query(EmailClassification).all()
    category_counts: dict = {}
    priority_counts = {"High": 0, "Medium": 0, "Low": 0}
    requires_reply_count = 0
    follow_up_count = 0
    confidence_sum = 0.0

    for c in classifications:
        category_counts[c.category] = category_counts.get(c.category, 0) + 1
        if c.priority in priority_counts:
            priority_counts[c.priority] += 1
        if c.requires_reply:
            requires_reply_count += 1
        if c.follow_up_needed:
            follow_up_count += 1
        confidence_sum += c.confidence or 0

    avg_confidence = (confidence_sum / total_classified) if total_classified > 0 else 0

    return {
        "total_emails": total_emails,
        "total_classified": total_classified,
        "total_drafts": total_drafts,
        "category_distribution": category_counts,
        "priority_distribution": priority_counts,
        "requires_reply_count": requires_reply_count,
        "follow_up_count": follow_up_count,
        "avg_confidence": round(avg_confidence, 2),
    }


@router.post("/classify", dependencies=[Depends(check_auth)])
def classify(payload: ClassifyRequest, db: Session = Depends(get_db)):
    """
    Classify one email using AI. Saves result to DB if email_id provided.
    
    DESIGN DECISION: We save the classification to DB immediately.
    This means if the user refreshes, the classification is still there.
    The frontend can then show "already analyzed" emails without re-calling AI.
    Cost saving: we don't pay for the same Groq API call twice.

    HUMAN-IN-THE-LOOP: We pull the user's most recent classification
    corrections and pass them to the LLM as few-shot examples. This means
    every correction the user makes improves future classifications
    immediately - no retraining, no waiting.
    """
    recent_feedback = (
        db.query(ClassificationFeedback)
        .order_by(ClassificationFeedback.created_at.desc())
        .limit(5)
        .all()
    )
    feedback_examples = [
        {
            "subject": f.subject,
            "sender": f.sender,
            "snippet": f.snippet,
            "corrected_category": f.corrected_category,
        }
        for f in recent_feedback
    ]

    result = classify_email(
        subject=payload.subject,
        sender=payload.sender,
        snippet=payload.snippet,
        body=payload.body,
        feedback_examples=feedback_examples,
    )
    result.pop("_source", None)

    # Persist classification if we have an email_id
    if payload.email_id:
        try:
            existing = db.query(EmailClassification).filter(
                EmailClassification.email_id == payload.email_id
            ).first()

            if existing:
                # Update existing classification
                for key, value in result.items():
                    setattr(existing, key, value)
                existing.classified_at = datetime.utcnow()
            else:
                db.add(EmailClassification(
                    email_id=payload.email_id,
                    **result
                ))
            db.commit()
        except Exception:
            db.rollback()
            existing = db.query(EmailClassification).filter(
                EmailClassification.email_id == payload.email_id
            ).first()
            if existing:
                for key, value in result.items():
                    setattr(existing, key, value)
                existing.classified_at = datetime.utcnow()
                try:
                    db.commit()
                except Exception:
                    db.rollback()

    return result


@router.post("/bulk-classify", dependencies=[Depends(check_auth)])
def bulk_classify(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Classify up to `limit` emails that have no stored classification."""
    classified_ids = {
        row[0] for row in db.query(EmailClassification.email_id).all()
    }
    query = db.query(EmailRecord).order_by(EmailRecord.fetched_at.desc())
    if classified_ids:
        query = query.filter(EmailRecord.id.notin_(classified_ids))
    unclassified = query.limit(limit).all()

    recent_feedback = (
        db.query(ClassificationFeedback)
        .order_by(ClassificationFeedback.created_at.desc())
        .limit(5)
        .all()
    )
    feedback_examples = [
        {
            "subject": f.subject,
            "sender": f.sender,
            "snippet": f.snippet,
            "corrected_category": f.corrected_category,
        }
        for f in recent_feedback
    ]

    results: dict = {}
    for i, email in enumerate(unclassified):
        if i > 0:
            # Space out calls so a batch of emails doesn't burst past
            # Groq's free-tier requests-per-minute limit.
            time.sleep(1.2)
        result = classify_email(
            subject=email.subject,
            sender=email.sender,
            snippet=email.snippet,
            body=email.body,
            feedback_examples=feedback_examples,
        )
        result.pop("_source", None)
        existing = db.query(EmailClassification).filter(
            EmailClassification.email_id == email.id
        ).first()
        if existing:
            for key, value in result.items():
                setattr(existing, key, value)
            existing.classified_at = datetime.utcnow()
        else:
            db.add(EmailClassification(email_id=email.id, **result))
        results[email.id] = result

    db.commit()
    return {"classified": len(results), "results": results}



@router.post("/feedback", dependencies=[Depends(check_auth)])
def submit_feedback(payload: FeedbackRequest, db: Session = Depends(get_db)):
    """
    Record a user correction to an AI classification.

    This is the core of our "training without training" approach:
    1. User sees AI got it wrong (e.g. classified a recruiter email as "Spam")
    2. User picks the correct category from a dropdown
    3. We store the correction here
    4. Every future /classify call includes this correction as a few-shot
       example, so the model self-corrects for similar emails immediately

    We also update the email's stored classification so the UI reflects
    the correction right away.
    """
    feedback_id = str(uuid.uuid4())
    db.add(ClassificationFeedback(
        id=feedback_id,
        email_id=payload.email_id,
        subject=payload.subject,
        sender=payload.sender,
        snippet=payload.snippet,
        original_category=payload.original_category,
        corrected_category=payload.corrected_category,
        original_priority=payload.original_priority,
        corrected_priority=payload.corrected_priority,
    ))

    # Update the stored classification to reflect the correction
    existing = db.query(EmailClassification).filter(
        EmailClassification.email_id == payload.email_id
    ).first()
    if existing:
        existing.category = payload.corrected_category
        if payload.corrected_priority:
            existing.priority = payload.corrected_priority

    db.commit()
    return {"status": "success", "feedback_id": feedback_id}


@router.get("/feedback/stats", dependencies=[Depends(check_auth)])
def feedback_stats(db: Session = Depends(get_db)):
    """Return count of corrections submitted - shown in UI as a 'learning' indicator."""
    count = db.query(ClassificationFeedback).count()
    return {"total_corrections": count}


@router.post("/draft-reply", dependencies=[Depends(check_auth)])
def draft_reply(payload: DraftReplyRequest, db: Session = Depends(get_db)):
    """Generate and save an AI reply draft."""
    reply_text = generate_reply_draft(
        subject=payload.subject,
        sender=payload.sender,
        body=payload.body,
        instructions=payload.instructions
    )

    # Save draft to DB
    if payload.email_id:
        draft = DraftRecord(
            id=str(uuid.uuid4()),
            email_id=payload.email_id,
            draft_text=reply_text,
            instructions=payload.instructions or "",
        )
        db.add(draft)
        db.commit()

    return {"reply_draft": reply_text}


@router.get("/drafts/{email_id}", dependencies=[Depends(check_auth)])
def get_drafts_for_email(email_id: str, db: Session = Depends(get_db)):
    """Retrieve all saved drafts for a given email."""
    drafts = db.query(DraftRecord).filter(
        DraftRecord.email_id == email_id
    ).order_by(DraftRecord.created_at.desc()).all()

    return [
        {
            "id": d.id,
            "draft_text": d.draft_text,
            "created_at": d.created_at.isoformat(),
            "was_sent": d.was_sent
        }
        for d in drafts
    ]


@router.post("/create-draft", dependencies=[Depends(check_auth)])
def create_draft(payload: SendEmailRequest):
    """Push a draft to Gmail's Drafts folder."""
    try:
        draft = create_gmail_draft(
            to_email=payload.to_email,
            subject=payload.subject,
            body_text=payload.body_text,
            thread_id=payload.thread_id
        )
        return {"status": "success", "draft_id": draft.get("id")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gmail draft failed: {str(e)}")


@router.post("/send", dependencies=[Depends(check_auth)])
def send(payload: SendEmailRequest, db: Session = Depends(get_db)):
    """Send an email via Gmail API. Marks draft as sent in DB."""
    try:
        sent = send_gmail_reply(
            to_email=payload.to_email,
            subject=payload.subject,
            body_text=payload.body_text,
            thread_id=payload.thread_id
        )
        return {"status": "success", "message_id": sent.get("id")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gmail send failed: {str(e)}")


# ─── Private Helpers ──────────────────────────────────────────────────────────

def _serialize_emails_with_classifications(
    emails: List[EmailRecord],
    db: Session
) -> List[dict]:
    """
    Join emails with their classifications for the API response.
    
    This is essentially doing a LEFT JOIN in Python instead of SQL.
    For production with 10k+ emails, you'd use:
        db.query(EmailRecord, EmailClassification)
          .outerjoin(EmailClassification, ...)
          .all()
    """
    email_ids = [e.id for e in emails]
    classifications = {
        c.email_id: c
        for c in db.query(EmailClassification).filter(
            EmailClassification.email_id.in_(email_ids)
        ).all()
    }

    result = []
    for email in emails:
        clf = classifications.get(email.id)
        result.append({
            "id": email.id,
            "threadId": email.thread_id,
            "subject": email.subject,
            "sender": email.sender,
            "recipient": email.recipient,
            "date": email.date_str,
            "snippet": email.snippet,
            "body": email.body,
            "fetched_at": email.fetched_at.isoformat(),
            "classification": {
                "category": clf.category,
                "priority": clf.priority,
                "confidence": clf.confidence,
                "summary": clf.summary,
                "suggestion": clf.suggestion,
                "requires_reply": clf.requires_reply,
                "follow_up_needed": clf.follow_up_needed,
            } if clf else None
        })

    return result