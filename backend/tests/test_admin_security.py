import pytest
import uuid
from datetime import datetime, timedelta, timezone
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import app
from app.database import AsyncSessionLocal
from app.core.security import create_session_token, hash_password
from models import User, Role, Workspace, WorkspaceInvitation, InvitationStatus


@pytest.mark.asyncio
class TestAdminSecurityAndAccessControl:
    """Verifies that only users with is_admin=True can access the admin panel and endpoints."""

    async def test_non_admin_advisor_blocked_from_admin_endpoints(self):
        advisor_id = uuid.uuid4()
        async with AsyncSessionLocal() as db:
            advisor = User(
                id=advisor_id,
                name="Regular Advisor",
                email=f"reg-advisor-{advisor_id}@example.com",
                password_hash=hash_password("Compliance#2026!"),
                role=Role.advisor,
                is_admin=False,
            )
            db.add(advisor)
            await db.commit()

        token = create_session_token(str(advisor_id), Role.advisor, is_admin=False)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"Authorization": f"Bearer {token}"}
            # GET /admin/invitations
            resp = await client.get("/admin/invitations", headers=headers)
            assert resp.status_code == 403
            assert "Administrator privileges required" in resp.json()["detail"]

            # GET /admin/team
            resp = await client.get("/admin/team", headers=headers)
            assert resp.status_code == 403
            assert "Administrator privileges required" in resp.json()["detail"]

            # POST /admin/invitations
            resp = await client.post(
                "/admin/invitations",
                headers=headers,
                json={"email": "new.hire@example.com", "role": "advisor"},
            )
            assert resp.status_code == 403
            assert "Administrator privileges required" in resp.json()["detail"]

    async def test_admin_can_invite_revoke_and_manage_team(self):
        admin_id = uuid.uuid4()
        member_id = uuid.uuid4()
        ws_id = uuid.uuid4()

        async with AsyncSessionLocal() as db:
            ws = Workspace(id=ws_id, name="Security Test Corp", slug=f"sec-test-{ws_id.hex[:6]}")
            db.add(ws)
            await db.commit()

            admin = User(
                id=admin_id,
                name="Chief Admin",
                email=f"admin-{admin_id}@example.com",
                password_hash=hash_password("Compliance#2026!"),
                role=Role.officer,
                workspace_id=ws_id,
                is_admin=True,
            )
            db.add(admin)

            member = User(
                id=member_id,
                name="Staff Member",
                email=f"staff-{member_id}@example.com",
                password_hash=hash_password("Compliance#2026!"),
                role=Role.advisor,
                workspace_id=ws_id,
                is_admin=False,
            )
            db.add(member)
            await db.commit()

        admin_token = create_session_token(str(admin_id), Role.officer, workspace_id=str(ws_id), is_admin=True)
        headers = {"Authorization": f"Bearer {admin_token}"}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. Admin creates invitation
            resp = await client.post(
                "/admin/invitations",
                headers=headers,
                json={
                    "email": f"invited-{uuid.uuid4().hex[:6]}@example.com",
                    "role": "officer",
                    "workspace_slug": ws.slug,
                },
            )
            assert resp.status_code == 200
            inv_data = resp.json()
            assert "invite_url" in inv_data
            token_val = inv_data["token"]

            # 2. Verify invitation in list
            list_resp = await client.get("/admin/invitations", headers=headers)
            assert list_resp.status_code == 200
            invitations = list_resp.json()["invitations"]
            matching = [i for i in invitations if i["token"] == token_val]
            assert len(matching) == 1
            inv_id = matching[0]["id"]

            # 3. Admin revokes invitation
            del_resp = await client.delete(f"/admin/invitations/{inv_id}", headers=headers)
            assert del_resp.status_code == 200
            assert del_resp.json()["status"] == "revoked"

            # 4. Admin cannot delete self
            self_del_resp = await client.delete(f"/admin/team/{admin_id}", headers=headers)
            assert self_del_resp.status_code == 400
            assert "cannot remove your own administrator account" in self_del_resp.json()["detail"].lower()

            # 5. Admin removes team member
            mem_del_resp = await client.delete(f"/admin/team/{member_id}", headers=headers)
            assert mem_del_resp.status_code == 200
            assert "removed from the workspace" in mem_del_resp.json()["message"].lower()

    async def test_create_workspace_flow(self):
        slug = f"firm-{uuid.uuid4().hex[:8]}"
        email = f"lead.officer-{uuid.uuid4().hex[:6]}@firm.com"

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/workspaces",
                json={
                    "workspace_name": "Acme Wealth Management",
                    "workspace_slug": slug,
                    "admin_name": "Jordan Lead",
                    "admin_email": email,
                    "admin_password": "StrongPassword#2026!",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["is_admin"] is True
            assert data["workspace_slug"] == slug
            assert data["slug"].startswith(slug)

    async def test_single_admin_constraint_rejects_duplicate_workspace_admin(self):
        """Verifies PostgreSQL partial unique index uq_workspace_single_admin prevents 2 admins in 1 workspace."""
        ws_id = uuid.uuid4()
        async with AsyncSessionLocal() as db:
            ws = Workspace(id=ws_id, name="Integrity Test Workspace", slug=f"ws-int-{ws_id.hex[:6]}")
            db.add(ws)
            await db.commit()

            admin1 = User(
                id=uuid.uuid4(),
                name="Primary Admin",
                email=f"admin1-{uuid.uuid4().hex[:6]}@example.com",
                password_hash=hash_password("Pass#1234!"),
                role=Role.officer,
                workspace_id=ws_id,
                is_admin=True,
            )
            db.add(admin1)
            await db.commit()

            # Attempt to add a 2nd admin to the same workspace
            admin2 = User(
                id=uuid.uuid4(),
                name="Rogue Secondary Admin",
                email=f"admin2-{uuid.uuid4().hex[:6]}@example.com",
                password_hash=hash_password("Pass#1234!"),
                role=Role.officer,
                workspace_id=ws_id,
                is_admin=True,
            )
            db.add(admin2)
            with pytest.raises(Exception) as exc_info:
                await db.commit()
            assert "uq_workspace_single_admin" in str(exc_info.value).lower() or "unique" in str(exc_info.value).lower()

    async def test_advisor_cannot_be_admin_check_constraint(self):
        """Verifies PostgreSQL check constraint chk_admin_must_be_officer prevents advisor from having is_admin=True."""
        ws_id = uuid.uuid4()
        async with AsyncSessionLocal() as db:
            ws = Workspace(id=ws_id, name="Check Constraint Workspace", slug=f"ws-chk-{ws_id.hex[:6]}")
            db.add(ws)
            await db.commit()

            advisor = User(
                id=uuid.uuid4(),
                name="Invalid Admin Advisor",
                email=f"advisor-bad-{uuid.uuid4().hex[:6]}@example.com",
                password_hash=hash_password("Pass#1234!"),
                role=Role.advisor,
                workspace_id=ws_id,
                is_admin=True,
            )
            db.add(advisor)
            with pytest.raises(Exception) as exc_info:
                await db.commit()
            assert "chk_admin_must_be_officer" in str(exc_info.value).lower() or "check" in str(exc_info.value).lower()

    async def test_accept_invitation_always_enforces_is_admin_false(self):
        """Verifies that accepting an invitation to a workspace resets user.is_admin = False."""
        ws_owner_id = uuid.uuid4()
        target_ws_id = uuid.uuid4()
        prev_admin_user_id = uuid.uuid4()
        user_email = f"invited-prev-admin-{uuid.uuid4().hex[:6]}@example.com"
        token_str = f"test-token-{uuid.uuid4().hex}"

        async with AsyncSessionLocal() as db:
            # Target workspace with legitimate owner
            ws = Workspace(id=target_ws_id, name="Destination Firm", slug=f"firm-dest-{target_ws_id.hex[:6]}")
            db.add(ws)
            await db.commit()

            owner = User(
                id=ws_owner_id,
                name="Sole Owner",
                email=f"owner-{ws_owner_id.hex[:6]}@destination.com",
                password_hash=hash_password("Pass#1234!"),
                role=Role.officer,
                workspace_id=target_ws_id,
                is_admin=True,
            )
            db.add(owner)

            # User who was previously admin in another workspace (no workspace_id now)
            prev_admin = User(
                id=prev_admin_user_id,
                name="Former Admin Elsewhere",
                email=user_email,
                password_hash=hash_password("Pass#1234!"),
                role=Role.officer,
                workspace_id=None,
                is_admin=True,
            )
            db.add(prev_admin)

            # Invitation issued for them to join Destination Firm as compliance officer
            inv = WorkspaceInvitation(
                workspace_id=target_ws_id,
                email=user_email,
                role=Role.officer,
                token=token_str,
                status=InvitationStatus.pending,
                expires_at=datetime.now(timezone.utc) + timedelta(days=2),
            )
            db.add(inv)
            await db.commit()

        # Accept invitation
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/invitations/accept",
                json={
                    "token": token_str,
                    "password": "NewSecurePassword#2026!",
                    "name": "Former Admin Joining",
                },
            )
            assert resp.status_code == 200

        # Verify in DB: user.is_admin MUST BE False!
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == prev_admin_user_id))
            updated_user = result.scalar_one()
            assert updated_user.workspace_id == target_ws_id
            assert updated_user.is_admin is False
            assert updated_user.role == Role.officer
