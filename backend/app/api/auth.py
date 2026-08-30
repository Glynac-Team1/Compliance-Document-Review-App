from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from models import User, Role
from app.core.security import hash_password, verify_password, create_session_token,decode_session_token

router = APIRouter()

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
        raise HTTPException(status_code=400, detail="Email already registered")
        
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
    return {"token": token, "role": new_user.role.value}

@router.post("/login")
async def login(req: AuthRequest, db: AsyncSession = Depends(get_db)):
    # Find the user by email
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    
    #  Verify the password matches the hash
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    #  Hand back a valid token
    token = create_session_token(str(user.id), user.role)
    return {"token": token, "role": user.role.value}


@router.get("/me")
async def get_current_user(token: dict = Depends(decode_session_token), db: AsyncSession = Depends(get_db)):
    user_id = token["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "name": user.name,
        "email": user.email,
        "role": user.role.value
    }
