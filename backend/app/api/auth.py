from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.core.security import verify_password, create_session_token

auth_router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@auth_router.post("/login", response_model=LoginResponse)
async def login(
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_session_token(str(user.id), user.role)
    return LoginResponse(access_token=token)
