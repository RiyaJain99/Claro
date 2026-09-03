from pathlib import Path
from os import environ

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / "app" / ".env")

CREDENTIALS_FILE = BASE_DIR / "credentials.json"
TOKEN_FILE = BASE_DIR / "token.json"
OAUTH_CACHE_DIR = BASE_DIR / ".oauth_cache"
REDIRECT_URI = environ.get("REDIRECT_URI", "http://localhost:8001/auth/callback")
FRONTEND_URL = environ.get("FRONTEND_URL", "http://localhost:5173")

# Start read-only for Day 1. Add compose/send scopes after approval UI is complete.
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
]
