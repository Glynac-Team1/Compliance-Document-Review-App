import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import generate_user_slug
from app.core.security import (
    create_session_token,
    decode_session_token,
    generate_secure_token,
    hash_password,
    validate_password_strength,
)
from app.database import get_db
from models import InvitationStatus, Role, User, Workspace, WorkspaceInvitation

router = APIRouter()


class CreateInvitationRequest(BaseModel):
    email: str
    role: Role
    workspace_slug: str = "northstar"


class AcceptInvitationRequest(BaseModel):
    token: str
    name: str
    password: str


async def require_admin_user(
    token: dict = Depends(decode_session_token),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Verifies that the requester has active Workspace Administrator privileges."""
    user_id = token.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing user identification.",
        )

    try:
        uid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token.",
        )

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace Administrator privileges required. You do not have permission to perform this action.",
        )

    return user


@router.post("/admin/invitations")
async def create_invitation(
    req: CreateInvitationRequest,
    admin: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Workspace Admin invites an employee by email with a locked pre-assigned role."""
    # Find workspace - strictly scoped to administrator's assigned workspace
    workspace = None
    if admin.workspace_id:
        ws_result = await db.execute(select(Workspace).where(Workspace.id == admin.workspace_id))
        workspace = ws_result.scalar_one_or_none()

    if not workspace:
        ws_result = await db.execute(select(Workspace).where(Workspace.slug == req.workspace_slug))
        workspace = ws_result.scalar_one_or_none()

    if not workspace:
        workspace = Workspace(name="Northstar Compliance", slug=req.workspace_slug)
        db.add(workspace)
        await db.commit()
        await db.refresh(workspace)

    # Check if this email is already an active user in this workspace
    user_result = await db.execute(select(User).where(User.email == req.email.lower()))
    existing_user = user_result.scalar_one_or_none()
    if existing_user and existing_user.workspace_id == workspace.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email is already an active member of this workspace.",
        )

    # Check if there's already a pending unexpired invitation
    inv_result = await db.execute(
        select(WorkspaceInvitation).where(
            and_(
                WorkspaceInvitation.workspace_id == workspace.id,
                WorkspaceInvitation.email == req.email.lower(),
                WorkspaceInvitation.status == InvitationStatus.pending,
            )
        )
    )
    existing_inv = inv_result.scalar_one_or_none()

    secure_token = generate_secure_token(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    if existing_inv:
        # Refresh existing invitation token and expiration
        existing_inv.token = secure_token
        existing_inv.role = req.role
        existing_inv.expires_at = expires_at
        existing_inv.status = InvitationStatus.pending
        invitation = existing_inv
    else:
        invitation = WorkspaceInvitation(
            workspace_id=workspace.id,
            email=req.email.lower(),
            role=req.role,
            token=secure_token,
            status=InvitationStatus.pending,
            expires_at=expires_at,
        )
        db.add(invitation)

    await db.commit()
    await db.refresh(invitation)

    invite_url = f"/accept-invite?token={invitation.token}"
    return {
        "message": f"Invitation successfully created for {req.email}",
        "email": invitation.email,
        "role": invitation.role.value,
        "workspace": workspace.name,
        "workspace_slug": workspace.slug,
        "token": invitation.token,
        "invite_url": invite_url,
        "expires_at": invitation.expires_at.isoformat(),
    }


@router.get("/invitations/verify/{token}")
async def verify_invitation(token: str, db: AsyncSession = Depends(get_db)):
    """Validates an invitation token for the onboarding acceptance screen."""
    result = await db.execute(
        select(WorkspaceInvitation, Workspace)
        .join(Workspace, WorkspaceInvitation.workspace_id == Workspace.id)
        .where(WorkspaceInvitation.token == token)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or unrecognized invitation link. Please request a new invitation from your administrator.",
        )

    invitation, workspace = row

    if invitation.status == InvitationStatus.accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invitation has already been accepted. Please sign in to your workspace.",
        )

    if invitation.status == InvitationStatus.revoked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation has been revoked by an administrator.",
        )

    now = datetime.now(timezone.utc)
    if invitation.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation link has expired. Please request a new invite from your administrator.",
        )

    return {
        "valid": True,
        "email": invitation.email,
        "role": invitation.role.value,
        "workspace_name": workspace.name,
        "workspace_slug": workspace.slug,
    }


@router.post("/invitations/accept")
async def accept_invitation(req: AcceptInvitationRequest, db: AsyncSession = Depends(get_db)):
    """Invited user sets their password, activates their account, and receives session token."""
    # 1. Enforce production-grade password strength
    validate_password_strength(req.password)

    # 2. Look up the invitation token
    result = await db.execute(
        select(WorkspaceInvitation, Workspace)
        .join(Workspace, WorkspaceInvitation.workspace_id == Workspace.id)
        .where(WorkspaceInvitation.token == req.token)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invitation token.",
        )

    invitation, workspace = row

    if invitation.status != InvitationStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation is no longer active.",
        )

    now = datetime.now(timezone.utc)
    if invitation.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired. Contact your administrator for a fresh link.",
        )

    # 3. Check if user already exists
    user_result = await db.execute(select(User).where(User.email == invitation.email))
    user = user_result.scalar_one_or_none()

    if user:
        # Update existing user to active workspace and role
        user.name = req.name.strip() or user.name
        user.password_hash = hash_password(req.password)
        user.role = invitation.role
        user.workspace_id = workspace.id
        user.is_admin = False  # Employee invitations strictly confer standard membership
    else:
        # Create brand new user with locked admin-assigned role
        user = User(
            name=req.name.strip() or "New User",
            email=invitation.email,
            password_hash=hash_password(req.password),
            role=invitation.role,  # LOCKED to admin's pre-assigned role!
            workspace_id=workspace.id,
            is_admin=False,
        )
        db.add(user)

    # Mark invitation as accepted
    invitation.status = InvitationStatus.accepted
    await db.commit()
    await db.refresh(user)

    # 4. Issue authenticated session token
    token = create_session_token(
        user_id=str(user.id),
        role=user.role,
        workspace_id=str(workspace.id),
    )
    slug = generate_user_slug(user.name, user.email, workspace.slug)

    return {
        "token": token,
        "role": user.role.value,
        "name": user.name,
        "email": user.email,
        "workspace_slug": workspace.slug,
        "workspace_name": workspace.name,
        "slug": slug,
        "message": f"Welcome to {workspace.name}! Your account is active.",
    }


@router.get("/admin/invitations")
async def list_workspace_invitations(
    admin: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all pending and historical invitations for the workspace."""
    query = (
        select(WorkspaceInvitation, Workspace.name, Workspace.slug)
        .join(Workspace, WorkspaceInvitation.workspace_id == Workspace.id)
        .order_by(WorkspaceInvitation.created_at.desc())
    )
    if admin.workspace_id:
        query = query.where(WorkspaceInvitation.workspace_id == admin.workspace_id)

    result = await db.execute(query)
    invites = []
    for inv, ws_name, ws_slug in result.all():
        invites.append({
            "id": str(inv.id),
            "email": inv.email,
            "role": inv.role.value,
            "status": inv.status.value,
            "workspace_name": ws_name,
            "workspace_slug": ws_slug,
            "token": inv.token,
            "invite_url": f"/accept-invite?token={inv.token}",
            "expires_at": inv.expires_at.isoformat(),
            "created_at": inv.created_at.isoformat(),
        })
    return {"invitations": invites}


@router.delete("/admin/invitations/{invitation_id}")
async def revoke_invitation(
    invitation_id: str,
    admin: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Revokes a pending workspace invitation, or purges an already revoked invitation."""
    try:
        inv_uuid = uuid.UUID(invitation_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invitation ID format.",
        )

    result = await db.execute(select(WorkspaceInvitation).where(WorkspaceInvitation.id == inv_uuid))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found.",
        )

    if admin.workspace_id and inv.workspace_id != admin.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot manage invitations outside your workspace.",
        )

    if inv.status == InvitationStatus.revoked:
        # Permanently purge already-revoked invitation
        await db.delete(inv)
        await db.commit()
        return {"message": f"Invitation for {inv.email} permanently purged.", "id": str(inv.id), "status": "deleted"}

    inv.status = InvitationStatus.revoked
    await db.commit()
    return {"message": f"Invitation for {inv.email} has been revoked.", "id": str(inv.id), "status": "revoked"}


@router.get("/admin/team")
async def list_workspace_team(
    admin: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Lists all active team members in the workspace."""
    query = (
        select(User, Workspace.slug)
        .outerjoin(Workspace, User.workspace_id == Workspace.id)
        .order_by(User.created_at.desc())
    )
    if admin.workspace_id:
        query = query.where(User.workspace_id == admin.workspace_id)
    else:
        query = query.where(User.workspace_id.isnot(None))

    result = await db.execute(query)
    members = []
    for u, ws_slug in result.all():
        if u.is_admin:
            access_level = "Workspace Administrator"
        elif u.role == Role.officer:
            access_level = "Compliance Officer"
        elif u.role == Role.advisor:
            access_level = "Financial Advisor"
        else:
            access_level = u.role.value.capitalize()

        members.append({
            "id": str(u.id),
            "name": u.name,
            "email": u.email,
            "role": u.role.value,
            "is_admin": u.is_admin,
            "access_level": access_level,
            "created_at": u.created_at.isoformat(),
            "slug": generate_user_slug(u.name, u.email, ws_slug or "northstar"),
        })
    return {"team": members}


@router.delete("/admin/team/{user_id}")
async def remove_team_member(
    user_id: str,
    admin: User = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Removes a user from the workspace."""
    try:
        member_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format.",
        )

    if member_uuid == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own administrator account.",
        )

    result = await db.execute(select(User).where(User.id == member_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    user.workspace_id = None
    await db.commit()
    return {"message": f"User {user.name} ({user.email}) has been removed from the workspace.", "id": str(user.id)}
