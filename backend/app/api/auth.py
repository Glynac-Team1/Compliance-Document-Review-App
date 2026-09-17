import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from models import User, Role, Workspace, WorkspaceInvitation, InvitationStatus
from app.core.security import (
    hash_password,
    verify_password,
    create_session_token,
    decode_session_token,
    validate_password_strength,
)

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
    invite_token: str | None = None
    workspace_slug: str = "northstar"


class LookupRequest(BaseModel):
    email: str


@router.post("/lookup-workspaces")
async def lookup_workspaces(req: LookupRequest, db: AsyncSession = Depends(get_db)):
    """Discovers which workspace(s) an email belongs to or has an active invitation for."""
    normalized_email = req.email.strip().lower()
    user_res = await db.execute(select(User).where(User.email == normalized_email))
    user = user_res.scalar_one_or_none()

    inv_res = await db.execute(
        select(WorkspaceInvitation, Workspace)
        .join(Workspace, WorkspaceInvitation.workspace_id == Workspace.id)
        .where(
            WorkspaceInvitation.email == normalized_email,
            WorkspaceInvitation.status == InvitationStatus.pending,
        )
    )
    inv_row = inv_res.first()

    if not user and not inv_row:
        return {
            "found": False,
            "message": "No active account or workspace invitation was found for this email. Please ask your compliance administrator to invite you.",
        }

    # Find associated workspace
    workspace_name = "Northstar Compliance"
    workspace_slug = "northstar"

    if user and user.workspace_id:
        ws_res = await db.execute(select(Workspace).where(Workspace.id == user.workspace_id))
        ws = ws_res.scalar_one_or_none()
        if ws:
            workspace_name = ws.name
            workspace_slug = ws.slug
    elif inv_row:
        inv, ws = inv_row
        workspace_name = ws.name
        workspace_slug = ws.slug

    return {
        "found": True,
        "status": "active" if user else "invited",
        "role": user.role.value if user else inv_row[0].role.value,
        "workspace": {
            "name": workspace_name,
            "slug": workspace_slug,
        },
        "invite_url": f"/accept-invite?token={inv_row[0].token}" if inv_row else None,
    }


@router.post("/signup")
async def signup(req: AuthRequest, db: AsyncSession = Depends(get_db)):
    normalized_email = req.email.strip().lower()

    # 1. Enforce password strength
    validate_password_strength(req.password)

    # 2. Check if the user already exists in Postgres
    result = await db.execute(select(User).where(User.email == normalized_email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # 3. Security Gate: Compliance Officers CANNOT self-register without an invitation
    if req.role == Role.officer:
        # Check if an invitation token was passed, or if a pending invitation exists for this email
        inv_query = select(WorkspaceInvitation).where(
            WorkspaceInvitation.email == normalized_email,
            WorkspaceInvitation.role == Role.officer,
            WorkspaceInvitation.status == InvitationStatus.pending,
        )
        if req.invite_token:
            inv_query = inv_query.where(WorkspaceInvitation.token == req.invite_token)

        inv_res = await db.execute(inv_query)
        invitation = inv_res.scalar_one_or_none()
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Compliance Officer accounts require an administrator invitation. Please ask your compliance administrator to invite your email address.",
            )
        invitation.status = InvitationStatus.accepted

    # 4. Resolve workspace
    ws_res = await db.execute(select(Workspace).where(Workspace.slug == req.workspace_slug))
    workspace = ws_res.scalar_one_or_none()
    workspace_id = workspace.id if workspace else None

    # 5. Hash password and save user
    new_user = User(
        email=normalized_email,
        password_hash=hash_password(req.password),
        role=req.role,
        name=req.name.strip() or "New User",
        workspace_id=workspace_id,
        is_admin=False,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # 6. Generate the JWT security token
    token = create_session_token(
        user_id=str(new_user.id),
        role=new_user.role,
        workspace_id=str(workspace_id) if workspace_id else None,
    )
    slug = generate_user_slug(new_user.name, new_user.email)
    return {
        "token": token,
        "role": new_user.role.value,
        "name": new_user.name,
        "slug": slug,
        "workspace_slug": req.workspace_slug,
    }


@router.post("/login")
async def login(req: AuthRequest, db: AsyncSession = Depends(get_db)):
    normalized_email = req.email.strip().lower()

    # Find the user by email
    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()
    
    # Verify the password matches the hash
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        
    # Resolve workspace info
    workspace_name = "Northstar Compliance"
    workspace_slug = req.workspace_slug or "northstar"
    if user.workspace_id:
        ws_res = await db.execute(select(Workspace).where(Workspace.id == user.workspace_id))
        ws = ws_res.scalar_one_or_none()
        if ws:
            workspace_name = ws.name
            workspace_slug = ws.slug

    # Hand back valid token with user metadata
    token = create_session_token(
        user_id=str(user.id),
        role=user.role,
        workspace_id=str(user.workspace_id) if user.workspace_id else None,
        is_admin=user.is_admin,
    )
    slug = generate_user_slug(user.name, user.email)
    return {
        "token": token,
        "role": user.role.value,
        "name": user.name,
        "slug": slug,
        "workspace_name": workspace_name,
        "workspace_slug": workspace_slug,
    }


@router.get("/me")
async def get_current_user(token: dict = Depends(decode_session_token), db: AsyncSession = Depends(get_db)):
    user_id = token["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    workspace_name = "Northstar Compliance"
    workspace_slug = "northstar"
    if user.workspace_id:
        ws_res = await db.execute(select(Workspace).where(Workspace.id == user.workspace_id))
        ws = ws_res.scalar_one_or_none()
        if ws:
            workspace_name = ws.name
            workspace_slug = ws.slug

    slug = generate_user_slug(user.name, user.email)
    return {
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "slug": slug,
        "workspace_name": workspace_name,
        "workspace_slug": workspace_slug,
        "is_admin": user.is_admin,
    }
