"""
FASTAPI APPLICATION ENTRY POINT

This file is the "spine" of the backend — it:
1. Creates the FastAPI app instance
2. Configures middleware (CORS, etc.)
3. Registers route modules
4. Creates database tables on startup

STARTUP EVENT:
FastAPI's lifespan system runs code before the first request.
We use it to create DB tables — this is a simple alternative to
Alembic migrations (which you'd add for a production app).

CORS (Cross-Origin Resource Sharing):
The frontend on localhost:5173 is a different "origin" than the backend on :8001.
Browsers block cross-origin requests by default for security.
CORS middleware tells the browser: "yes, this frontend is allowed to talk to this backend."
INTERVIEW: "What is CORS and why do you need it?"
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import create_tables
from app.routes import auth, health, emails


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run setup before the server starts accepting requests."""
    print("[Startup] Creating database tables...")
    create_tables()
    print("[Startup] Database ready.")
    yield
    # Code after yield runs on shutdown — good place to close connections


app = FastAPI(
    title="AI Email Agent API",
    description="Gmail-powered AI email assistant with classification and smart replies",
    version="2.0.0",
    lifespan=lifespan
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ─── Routes ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(emails.router)

# ─── Frontend Serving ─────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "dist" / "assets")), name="assets")

@app.get("/", include_in_schema=False)
def read_root():
    index_path = FRONTEND_DIR / "dist" / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {
        "message": "AI Email Agent Backend v2.0 is running.",
        "docs": "/docs",
        "health": "/health"
    }