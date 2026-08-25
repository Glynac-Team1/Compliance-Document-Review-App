# backend/app/core/security.py
from fastapi import Depends, HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings
from app.models import Role

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    return pwd_context.verify(raw, hashed)


def create_session_token(user_id: str, role: Role) -> str:
    return jwt.encode({"sub": user_id, "role": role.value}, settings.session_secret, algorithm="HS256")


def decode_session_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.session_secret, algorithms=["HS256"])
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
