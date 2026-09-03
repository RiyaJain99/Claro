import base64
import os
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional, List, Dict, Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.config import TOKEN_FILE, SCOPES

MOCK_EMAILS = [
    {
        "id": "msg_001",
        "threadId": "thread_001",
        "subject": "Q3 Product Roadmap Review & Resource Allocation",
        "sender": "sarah.chen@techcorp.com",
        "recipient": "me@domain.com",
        "date": "Fri, 07 Aug 2026 09:15:00 +0000",
        "snippet": "Hi team, please find attached the revised Q3 product roadmap. We need to finalize resource allocation for the AI Email Agent module before Monday's planning meeting.",
        "body": "Hi team,\n\nPlease find attached the revised Q3 product roadmap. We need to finalize resource allocation for the AI Email Agent module before Monday's planning meeting.\n\nKey discussion points:\n1. Backend API scaling & database connection pooling\n2. Frontend UI polish and user feedback integration\n3. Integration of Groq LLM model for zero-shot classification\n\nPlease reply with your availability for a 30-minute sync tomorrow afternoon.\n\nBest regards,\nSarah Chen\nVP of Product",
    },
    {
        "id": "msg_002",
        "threadId": "thread_002",
        "subject": "URGENT: Production Database Connection Timeout Spike",
        "sender": "alerts@pagerduty.com",
        "recipient": "me@domain.com",
        "date": "Fri, 07 Aug 2026 08:42:00 +0000",
        "snippet": "[ALERT HIGH SEVERITY] Database connection pool exhausted on us-east-1 prod instance db-primary-02. Immediate action required.",
        "body": "[ALERT HIGH SEVERITY]\nIncident #48291: Database connection pool exhausted on us-east-1 prod instance db-primary-02.\n\nTime triggered: 08:41:20 UTC\nAffected service: User Auth & Analytics Service\nCurrent latency: > 4500ms (threshold: 500ms)\n\nPlease check active query log and scale replica pool.",
    },
    {
        "id": "msg_003",
        "threadId": "thread_003",
        "subject": "Candidate Application: Senior Full-Stack Engineer - Alex Rivera",
        "sender": "alex.rivera.dev@gmail.com",
        "recipient": "hiring@domain.com",
        "date": "Thu, 06 Aug 2026 18:20:00 +0000",
        "snippet": "Dear Hiring Manager, I am submitting my application for the Senior Full-Stack Engineer role. With 6+ years building React and Python microservices...",
        "body": "Dear Hiring Manager,\n\nI am submitting my application for the Senior Full-Stack Engineer role at your company. With 6+ years of experience building high-performance React and FastAPI web applications, I am confident I can add immediate value to your engineering team.\n\nI have attached my resume and portfolio links.\n\nLooking forward to hearing from you,\nAlex Rivera",
    },
    {
        "id": "msg_004",
        "threadId": "thread_004",
        "subject": "Invoice #INV-2026-089 Overdue Notice",
        "sender": "billing@cloudservices.io",
        "recipient": "me@domain.com",
        "date": "Thu, 06 Aug 2026 14:10:00 +0000",
        "snippet": "Friendly reminder: Payment for Invoice #INV-2026-089 ($1,250.00 USD) was due on Aug 1, 2026. Please update your payment method.",
        "body": "Hi there,\n\nThis is a notification that invoice #INV-2026-089 for $1,250.00 USD (Cloud Hosting & Inference API Usage) remains unpaid.\n\nDue Date: Aug 1, 2026\nStatus: OVERDUE (6 days)\n\nTo avoid service interruption, please log in to your billing portal and process payment at your earliest convenience.\n\nThank you,\nCloudServices Billing Team",
    },
    {
        "id": "msg_005",
        "threadId": "thread_005",
        "subject": "Weekly Tech Newsletter: What's New in FastAPI 0.128 & React 19",
        "sender": "editor@devweekly.io",
        "recipient": "me@domain.com",
        "date": "Wed, 05 Aug 2026 11:00:00 +0000",
        "snippet": "In this edition: React 19 Server Components deep dive, FastAPI performance tricks, and top open-source AI tools of the month.",
        "body": "Welcome to DevWeekly Issue #312!\n\nThis week we cover:\n- React 19 Action hooks and transition state management\n- FastAPI asynchronous connection pool best practices\n- LLM structured outputs with Pydantic v2\n\nClick here to read the full issue online.",
    },
    {
        "id": "msg_006",
        "threadId": "thread_006",
        "subject": "Customer Inquiry: Enterprise Plan Pricing & Security Compliance",
        "sender": "david.k@enterpriseclient.org",
        "recipient": "sales@domain.com",
        "date": "Wed, 05 Aug 2026 09:30:00 +0000",
        "snippet": "Hello Sales Team, Our organization is evaluating your platform for 250+ users. Do you support SOC2 Type II compliance and custom SSO integration?",
        "body": "Hello Sales Team,\n\nOur procurement and security team is currently evaluating your email AI solution for deployment across our enterprise (approx 250 users).\n\nCould you please provide:\n1. Enterprise tier pricing schedule\n2. SOC2 Type II compliance report\n3. Support for SAML / Okta SSO integration\n\nWe would love to schedule a quick demo call this week.\n\nThanks,\nDavid Kaplan\nIT Security Director",
    }
]


def get_gmail_creds() -> Optional[Credentials]:
    """Load and refresh credentials if they exist."""
    if not TOKEN_FILE.exists():
        return None

    try:
        content = TOKEN_FILE.read_text()
        if "demo-token" in content or '"mock": true' in content:
            return None
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            TOKEN_FILE.write_text(creds.to_json())
        return creds if creds and creds.valid else None
    except Exception:
        return None

def is_authenticated() -> bool:
    """Check if valid Gmail credentials or Demo mode active."""
    if TOKEN_FILE.exists():
        try:
            content = TOKEN_FILE.read_text()
            if "demo-token" in content or '"mock": true' in content:
                return True
        except Exception:
            pass
    creds = get_gmail_creds()
    return creds is not None and creds.valid

def get_gmail_service():
    """Build and return Gmail API service client."""
    creds = get_gmail_creds()
    if not creds:
        raise ValueError("User not authenticated with Google. Please log in.")
    return build('gmail', 'v1', credentials=creds)

def parse_email_body(payload: Dict[str, Any]) -> str:
    """Recursively parse plain text body from the message payload."""
    if 'parts' in payload:
        for part in payload['parts']:
            mime_type = part.get('mimeType')
            body = part.get('body', {})
            data = body.get('data')
            if mime_type == 'text/plain' and data:
                try:
                    return base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                except Exception:
                    pass
        for part in payload['parts']:
            if 'parts' in part:
                body_text = parse_email_body(part)
                if body_text:
                    return body_text
    else:
        body = payload.get('body', {})
        data = body.get('data')
        if data:
            try:
                return base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
            except Exception:
                pass
    return ""

def get_latest_emails(max_results: int = 15) -> List[Dict[str, Any]]:
    """Fetch the latest messages from the user's Gmail inbox or return demo emails."""
    try:
        service = get_gmail_service()
        results = service.users().messages().list(
            userId='me', 
            q='label:INBOX', 
            maxResults=max_results
        ).execute()
        
        messages = results.get('messages', [])
        if not messages:
            return MOCK_EMAILS[:max_results]

        parsed_emails = []
        for msg in messages:
            try:
                msg_detail = service.users().messages().get(
                    userId='me', 
                    id=msg['id'], 
                    format='full'
                ).execute()
                
                headers = msg_detail.get('payload', {}).get('headers', [])
                subject = "No Subject"
                sender = "Unknown Sender"
                recipient = "Unknown Recipient"
                date = ""
                
                for h in headers:
                    name = h.get('name', '').lower()
                    if name == 'subject':
                        subject = h.get('value')
                    elif name == 'from':
                        sender = h.get('value')
                    elif name == 'to':
                        recipient = h.get('value')
                    elif name == 'date':
                        date = h.get('value')
                
                snippet = msg_detail.get('snippet', '')
                body = parse_email_body(msg_detail.get('payload', {}))
                
                parsed_emails.append({
                    "id": msg['id'],
                    "threadId": msg['threadId'],
                    "subject": subject,
                    "sender": sender,
                    "recipient": recipient,
                    "date": date,
                    "snippet": snippet,
                    "body": body or snippet
                })
            except Exception as e:
                print(f"Error fetching message {msg['id']}: {e}")
                continue
                
        return parsed_emails if parsed_emails else MOCK_EMAILS[:max_results]
    except Exception as e:
        print(f"[GmailService] Demo/Fallback mode active: {e}")
        return MOCK_EMAILS[:max_results]

def create_gmail_draft(to_email: str, subject: str, body_text: str, thread_id: Optional[str] = None) -> Dict[str, Any]:
    """Create a draft reply in the user's Gmail account or return mock draft in demo mode."""
    try:
        service = get_gmail_service()
        message = MIMEText(body_text)
        message['to'] = to_email
        message['subject'] = subject
        raw_message = {}
        if thread_id:
            raw_message['threadId'] = thread_id
        raw_message['raw'] = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
        draft_body = {'message': raw_message}
        return service.users().drafts().create(userId='me', body=draft_body).execute()
    except Exception as e:
        print(f"[GmailService] Demo mode create_gmail_draft: {e}")
        return {"id": "demo_draft_123", "message": {"id": "demo_msg_123"}}

def send_gmail_reply(to_email: str, subject: str, body_text: str, thread_id: Optional[str] = None) -> Dict[str, Any]:
    """Send an email directly from the user's Gmail account or return mock response in demo mode."""
    try:
        service = get_gmail_service()
        message = MIMEText(body_text)
        message['to'] = to_email
        message['subject'] = subject
        raw_message = {}
        if thread_id:
            raw_message['threadId'] = thread_id
        raw_message['raw'] = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
        return service.users().messages().send(userId='me', body=raw_message).execute()
    except Exception as e:
        print(f"[GmailService] Demo mode send_gmail_reply: {e}")
        return {"id": "demo_sent_123"}

