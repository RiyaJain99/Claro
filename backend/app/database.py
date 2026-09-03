from datetime import datetime
from sqlalchemy import create_engine, Column, String, Text, DateTime, Float, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, Session
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./email_agent.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class EmailRecord(Base):
    __tablename__ = "emails"
    id = Column(String, primary_key=True)
    thread_id = Column(String, index=True)
    subject = Column(Text, default="No Subject")
    sender = Column(Text, default="Unknown")
    recipient = Column(Text, default="")
    date_str = Column(String, default="")
    snippet = Column(Text, default="")
    body = Column(Text, default="")
    fetched_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)

class EmailClassification(Base):
    __tablename__ = "classifications"
    email_id = Column(String, primary_key=True)
    category = Column(String, default="Uncategorized")
    priority = Column(String, default="Medium")
    confidence = Column(Float, default=0.0)
    summary = Column(Text, default="")
    suggestion = Column(Text, default="")
    requires_reply = Column(Boolean, default=False)
    follow_up_needed = Column(Boolean, default=False)
    classified_at = Column(DateTime, default=datetime.utcnow)
    model_used = Column(String, default="llama-3.1-8b-instant")

class ClassificationFeedback(Base):
    """
    Stores user corrections to AI classifications.

    WHY THIS MATTERS (interview talking point):
    Instead of retraining a model, we capture human corrections and feed
    them back into the prompt as few-shot examples ("active learning" /
    "human-in-the-loop" pattern). This is how production LLM systems
    actually improve over time without fine-tuning - cheaper, faster,
    and fully explainable.
    """
    __tablename__ = "classification_feedback"
    id = Column(String, primary_key=True)
    email_id = Column(String, index=True)
    subject = Column(Text, default="")
    sender = Column(Text, default="")
    snippet = Column(Text, default="")
    original_category = Column(String, default="")
    corrected_category = Column(String, default="")
    original_priority = Column(String, default="")
    corrected_priority = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class DraftRecord(Base):
    __tablename__ = "drafts"
    id = Column(String, primary_key=True)
    email_id = Column(String, index=True)
    draft_text = Column(Text, default="")
    instructions = Column(Text, default="")
    was_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

def create_tables():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
