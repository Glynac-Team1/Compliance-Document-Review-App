import re
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.config import settings

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

def generate_user_slug(
    name: str | None,
    email: str | None = None,
    workspace_slug: str | None = None,
) -> str:
    """Generate a clean URL-friendly identifier combining workspace and user name or email."""
    user_part = ""
    if name and name.strip() and name.strip().lower() != "new user":
        user_part = re.sub(r'[^a-zA-Z0-9]+', '-', name.strip()).strip('-').lower()
    if not user_part and email and "@" in email:
        user_part = re.sub(r'[^a-zA-Z0-9]+', '-', email.split("@")[0].strip()).strip('-').lower()

    ws_clean = ""
    if workspace_slug and workspace_slug.strip():
        ws_clean = re.sub(r'[^a-zA-Z0-9]+', '-', workspace_slug.strip()).strip('-').lower()

    if ws_clean and user_part:
        return f"{ws_clean}-{user_part}"
    elif ws_clean and not user_part:
        return f"{ws_clean}-member"
    elif user_part:
        return user_part
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

    # 3. Security Gate: Individuals CANNOT self-register into any role without an administrator invitation
    inv_query = (
        select(WorkspaceInvitation, Workspace)
        .join(Workspace, WorkspaceInvitation.workspace_id == Workspace.id)
        .where(
            WorkspaceInvitation.email == normalized_email,
            WorkspaceInvitation.role == req.role,
            WorkspaceInvitation.status == InvitationStatus.pending,
        )
    )
    if req.invite_token:
        inv_query = inv_query.where(WorkspaceInvitation.token == req.invite_token)

    inv_res = await db.execute(inv_query)
    inv_row = inv_res.first()
    if not inv_row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Self-registration is disabled. Joining as a {req.role.value.capitalize()} requires a single-use onboarding invitation dispatched by your organization administrator.",
        )
    invitation, workspace = inv_row
    invitation.status = InvitationStatus.accepted
    workspace_id = workspace.id
    resolved_workspace_slug = workspace.slug

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
    slug = generate_user_slug(new_user.name, new_user.email, req.workspace_slug)
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
    slug = generate_user_slug(user.name, user.email, workspace_slug)
    return {
        "token": token,
        "role": user.role.value,
        "name": user.name,
        "slug": slug,
        "workspace_name": workspace_name,
        "workspace_slug": workspace_slug,
        "is_admin": user.is_admin,
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

    slug = generate_user_slug(user.name, user.email, workspace_slug)
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "slug": slug,
        "workspace_name": workspace_name,
        "workspace_slug": workspace_slug,
        "is_admin": user.is_admin,
    }


class CreateWorkspaceRequest(BaseModel):
    workspace_name: str
    workspace_slug: str | None = None
    admin_name: str
    admin_email: str
    admin_password: str


@router.post("/workspaces")
async def create_new_workspace(req: CreateWorkspaceRequest, db: AsyncSession = Depends(get_db)):
    """Allows a new financial firm to register an organization workspace with an initial Administrator."""
    validate_password_strength(req.admin_password)

    # Server-side generation of organization identifier
    raw_slug = req.workspace_slug.strip() if req.workspace_slug and req.workspace_slug.strip() else ""
    if not raw_slug:
        raw_slug = re.sub(r'[^a-zA-Z0-9]+', '-', req.workspace_name.strip()).strip('-').lower()
    if not raw_slug:
        raw_slug = "workspace"

    # Ensure unique slug server-side
    slug = raw_slug
    ws_res = await db.execute(select(Workspace).where(Workspace.slug == slug))
    if ws_res.scalar_one_or_none():
        slug = f"{raw_slug}-{secrets.token_hex(2)}"
        # Check again to guarantee uniqueness
        while True:
            ws_check = await db.execute(select(Workspace).where(Workspace.slug == slug))
            if not ws_check.scalar_one_or_none():
                break
            slug = f"{raw_slug}-{secrets.token_hex(3)}"

    user_res = await db.execute(select(User).where(User.email == req.admin_email.strip().lower()))
    existing_user = user_res.scalar_one_or_none()

    workspace = Workspace(name=req.workspace_name.strip(), slug=slug)
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)

    if existing_user:
        existing_user.workspace_id = workspace.id
        existing_user.is_admin = True
        existing_user.role = Role.officer
        existing_user.password_hash = hash_password(req.admin_password)
        existing_user.name = req.admin_name.strip() or existing_user.name
        admin_user = existing_user
    else:
        admin_user = User(
            name=req.admin_name.strip(),
            email=req.admin_email.strip().lower(),
            password_hash=hash_password(req.admin_password),
            role=Role.officer,
            workspace_id=workspace.id,
            is_admin=True,
        )
        db.add(admin_user)

    initial_recovery_key = None
    if not admin_user.recovery_key_hash:
        initial_recovery_key = f"rec_{secrets.token_urlsafe(24)}"
        admin_user.recovery_key_hash = hash_password(initial_recovery_key)

    await db.commit()
    await db.refresh(admin_user)

    token = create_session_token(
        user_id=str(admin_user.id),
        role=admin_user.role,
        workspace_id=str(workspace.id),
        is_admin=True,
    )
    user_slug = generate_user_slug(admin_user.name, admin_user.email, workspace.slug)

    return {
        "token": token,
        "role": admin_user.role.value,
        "name": admin_user.name,
        "email": admin_user.email,
        "slug": user_slug,
        "workspace_name": workspace.name,
        "workspace_slug": workspace.slug,
        "is_admin": True,
        "recovery_key": initial_recovery_key,
        "message": f"Workspace '{workspace.name}' successfully created.",
    }


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Public endpoint: Validates single-use reset token and updates user password."""
    validate_password_strength(req.password)

    clean_token = req.token.strip()
    result = await db.execute(select(User).where(User.reset_token == clean_token))
    user = result.scalar_one_or_none()

    if not user or not user.reset_token_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid. Please request a new link from your administrator.",
        )

    now = datetime.now(timezone.utc)
    if user.reset_token_expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This password reset link has expired. Please request a new link from your administrator.",
        )

    user.password_hash = hash_password(req.password)
    user.reset_token = None
    user.reset_token_expires_at = None
    await db.commit()

    return {
        "success": True,
        "message": "Password updated successfully. You can now sign in with your new password.",
    }


class AdminRecoveryRequest(BaseModel):
    email: str
    recovery_key: str
    new_password: str


@router.post("/admin/recover")
async def admin_recovery(req: AdminRecoveryRequest, db: AsyncSession = Depends(get_db)):
    """Master recovery key endpoint: Admin recovers access without email dependency."""
    validate_password_strength(req.new_password)

    clean_email = req.email.strip().lower()
    clean_key = req.recovery_key.strip()

    result = await db.execute(select(User).where(User.email == clean_email))
    user = result.scalar_one_or_none()

    if not user or not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrator credentials.",
        )

    if not user.recovery_key_hash or not verify_password(clean_key, user.recovery_key_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid master recovery key.",
        )

    new_recovery_key = f"rec_{secrets.token_urlsafe(24)}"
    user.password_hash = hash_password(req.new_password)
    user.recovery_key_hash = hash_password(new_recovery_key)
    await db.commit()

    return {
        "success": True,
        "message": "Admin password successfully updated.",
        "new_recovery_key": new_recovery_key,
    }
