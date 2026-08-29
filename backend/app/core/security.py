# backend/app/core/security.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
import bcrypt
from app.config import settings
from models import Role

bearer_scheme = HTTPBearer(auto_error=False)

def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(raw: str, hashed: str) -> bool:
    return bcrypt.checkpw(raw.encode('utf-8'), hashed.encode('utf-8'))


def create_session_token(user_id: str, role: Role) -> str:
    return jwt.encode({"sub": user_id, "role": role.value}, settings.session_secret, algorithm="HS256")


def decode_session_token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        return jwt.decode(credentials.credentials, settings.session_secret, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid session") from exc


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
