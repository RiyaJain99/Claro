from typing import Optional

import os

from google_auth_oauthlib.flow import Flow

from app.config import CREDENTIALS_FILE, REDIRECT_URI, SCOPES

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"


def create_oauth_flow(
    state: Optional[str] = None,
    code_verifier: Optional[str] = None,
    autogenerate_code_verifier: bool = True,
) -> Flow:
    """Build a Google OAuth flow from credentials.json."""
    if not CREDENTIALS_FILE.exists():
        raise FileNotFoundError(
            f"Credentials file missing at {CREDENTIALS_FILE}. "
            "Please place Google OAuth credentials.json in the backend/ directory."
        )
    return Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        state=state,
        redirect_uri=REDIRECT_URI,
        code_verifier=code_verifier,
        autogenerate_code_verifier=autogenerate_code_verifier,
    )

