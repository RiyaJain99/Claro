import hashlib
import json
import time
from pathlib import Path
from threading import Lock
from typing import Optional

from app.config import OAUTH_CACHE_DIR

_lock = Lock()
TTL_SECONDS = 600


def _cache_path(state: str) -> Path:
    digest = hashlib.sha256(state.encode()).hexdigest()
    return OAUTH_CACHE_DIR / f"{digest}.json"


def store_code_verifier(state: str, code_verifier: str) -> None:
    OAUTH_CACHE_DIR.mkdir(exist_ok=True)
    payload = {
        "state": state,
        "code_verifier": code_verifier,
        "created_at": time.time(),
    }
    with _lock:
        _cache_path(state).write_text(json.dumps(payload))


def pop_code_verifier(state: str) -> Optional[str]:
    OAUTH_CACHE_DIR.mkdir(exist_ok=True)
    with _lock:
        path = _cache_path(state)
        if not path.exists():
            return None

        data = json.loads(path.read_text())
        path.unlink(missing_ok=True)

        if data.get("state") != state:
            return None
        if time.time() - data.get("created_at", 0) > TTL_SECONDS:
            return None

        return data.get("code_verifier")
