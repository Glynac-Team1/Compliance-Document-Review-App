import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from models import User, Role
from app.core.security import hash_password, verify_password, create_session_token, decode_session_token

router = APIRouter()

def generate_user_slug(name: str | None, email: str | None = None) -> str:
    """Generate a clean URL-friendly identifier from user name or email."""
    if name and name.strip() and name.strip().lower() != "new user":
        clean = re.sub(r'[^a-zA-Z0-9]+', '-', name.strip()).strip('-').lower()
        if clean:
            return clean
    if email and "@" in email:
        clean = re.sub(r'[^a-zA-Z0-9]+', '-', email.split("@")[0].strip()).strip('-').lower()
        if clean:
            return clean
    return "workspace"

# Data expected from frontend
class AuthRequest(BaseModel):
    email: str
    password: str
    role: Role = Role.advisor 
    name: str = "New User"

@router.post("/signup")
async def signup(req: AuthRequest, db: AsyncSession = Depends(get_db)):
    # Check if the user already exists in Postgres
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        
    # Hash the password and save the new user
    new_user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        role=req.role,
        name=req.name
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Generate the JWT security token
    token = create_session_token(str(new_user.id), new_user.role)
    slug = generate_user_slug(new_user.name, new_user.email)
    return {
        "token": token,
        "role": new_user.role.value,
        "name": new_user.name,
        "slug": slug,
    }

@router.post("/login")
async def login(req: AuthRequest, db: AsyncSession = Depends(get_db)):
    # Find the user by email
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    
    # Verify the password matches the hash
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        
    # Hand back a valid token with user metadata
    token = create_session_token(str(user.id), user.role)
    slug = generate_user_slug(user.name, user.email)
    return {
        "token": token,
        "role": user.role.value,
        "name": user.name,
        "slug": slug,
    }


@router.get("/me")
async def get_current_user(token: dict = Depends(decode_session_token), db: AsyncSession = Depends(get_db)):
    user_id = token["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    slug = generate_user_slug(user.name, user.email)
    return {
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "slug": slug,
    }
