from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse

from app.config import TOKEN_FILE, FRONTEND_URL, CREDENTIALS_FILE
from app.oauth import create_oauth_flow
from app.oauth_store import pop_code_verifier, store_code_verifier
from app.gmail_service import is_authenticated

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login")
def login():
    """Redirect the user to Google's OAuth consent page or demo session if credentials.json is absent."""
    if not TOKEN_FILE.parent.exists():
        TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)

    if not CREDENTIALS_FILE.exists():
        print("[Auth] credentials.json not found. Initiating Demo session.")
        TOKEN_FILE.write_text('{"token": "demo-token", "mock": true}')
        return RedirectResponse(url=f"{FRONTEND_URL}/?auth=success&mode=demo")

    try:
        flow = create_oauth_flow()
        authorization_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        store_code_verifier(state, flow.code_verifier)
        return RedirectResponse(url=authorization_url)
    except FileNotFoundError as e:
        print(f"[Auth] {e}. Initiating Demo session.")
        TOKEN_FILE.write_text('{"token": "demo-token", "mock": true}')
        return RedirectResponse(url=f"{FRONTEND_URL}/?auth=success&mode=demo")



@router.get("/callback")
def callback(request: Request):
    """Exchange the authorization code for tokens and redirect to frontend."""
    state = request.query_params.get("state")
    if not state:
        return JSONResponse(
            status_code=400,
            content={"error": "Missing state parameter."},
        )

    code_verifier = pop_code_verifier(state)
    if not code_verifier:
        return JSONResponse(
            status_code=400,
            content={
                "error": (
                    "OAuth session expired or invalid. "
                    "Open the app home page and sign in again."
                )
            },
        )

    try:
        flow = create_oauth_flow(
            state=state,
            code_verifier=code_verifier,
            autogenerate_code_verifier=False,
        )
        flow.fetch_token(authorization_response=str(request.url))

        TOKEN_FILE.write_text(flow.credentials.to_json())

        return RedirectResponse(url=f"{FRONTEND_URL}/?auth=success")
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


@router.get("/status")
def status():
    """Check if the backend is authenticated with Gmail."""
    return {"authenticated": is_authenticated()}


@router.post("/logout")
def logout():
    """Disconnect Google account by deleting token.json."""
    if TOKEN_FILE.exists():
        try:
            TOKEN_FILE.unlink()
            return {"message": "Logged out successfully."}
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": f"Failed to log out: {e}"})
    return {"message": "Already logged out."}
