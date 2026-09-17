from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
import bcrypt
from app.config import settings
from models import Role

bearer_scheme = HTTPBearer(auto_error=False)
DEFAULT_SESSION_DURATION = timedelta(days=7)

def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(raw: str, hashed: str) -> bool:
    return bcrypt.checkpw(raw.encode('utf-8'), hashed.encode('utf-8'))


import secrets
import re

COMMON_WEAK_PASSWORDS = {
    "password", "password123", "12345678", "123456789", "admin123",
    "qwerty123", "welcome123", "letmein123", "compliance123"
}
COMMON_WEAK_BASES = {"password", "admin", "welcome", "qwerty", "letmein", "compliance"}

def validate_password_strength(password: str) -> None:
    """Enforces enterprise password policy:
    - Minimum 8 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one number (0-9)
    - At least one special symbol
    - Not a common dictionary word or predictable pattern
    """
    if not password or len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long."
        )
    
    clean_base = re.sub(r'[\d!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]', '', password.lower())
    if password.lower() in COMMON_WEAK_PASSWORDS or clean_base in COMMON_WEAK_BASES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is too common or easily guessable. Please choose a stronger password."
        )
    if not re.search(r"[A-Z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one uppercase letter (A-Z)."
        )
    if not re.search(r"[a-z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one lowercase letter (a-z)."
        )
    if not re.search(r"\d", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one number (0-9)."
        )
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one special symbol (!@#$%^&*...)."
        )

def generate_secure_token(nbytes: int = 32) -> str:
    """Generates a cryptographically random, URL-safe 256-bit token using OS CSPRNG."""
    return secrets.token_urlsafe(nbytes)

def create_session_token(
    user_id: str,
    role: Role,
    workspace_id: str | None = None,
    is_admin: bool = False,
    expires_delta: timedelta | None = None
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta if expires_delta is not None else DEFAULT_SESSION_DURATION)
    payload = {
        "sub": str(user_id),
        "role": role.value,
        "workspace_id": str(workspace_id) if workspace_id else None,
        "is_admin": is_admin,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.session_secret, algorithm="HS256")


def decode_session_token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        return jwt.decode(credentials.credentials, settings.session_secret, algorithms=["HS256"])
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again."
        ) from exc
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session"
        ) from exc


def require_role(required: Role):
    """A dependency FACTORY: returns a dependency pre-configured for one
    role, so `Depends(require_role(Role.officer))` on a route makes every
    request to it prove it's an officer, or get a 403 — before any
    endpoint logic runs at all."""
    def dependency(token: dict = Depends(decode_session_token)) -> dict:
        if token.get("role") != required.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return token
    return dependency


def require_any_role(*required_roles: Role):
    """A dependency factory that authorizes a user if they hold any of the given roles."""
    def dependency(token: dict = Depends(decode_session_token)) -> dict:
        allowed = {r.value for r in required_roles}
        if token.get("role") not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return token
    return dependency


def decode_raw_token(token_str: str) -> dict:
    """Decodes and validates a raw JWT token string (e.g. from query parameters)."""
    try:
        return jwt.decode(token_str, settings.session_secret, algorithms=["HS256"])
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again."
        ) from exc
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session"
        ) from exc

