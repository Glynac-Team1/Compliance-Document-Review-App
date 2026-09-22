import pytest
import uuid
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import app
from app.database import AsyncSessionLocal
from app.core.security import hash_password, verify_password
from models import User, Role, Workspace


@pytest.mark.asyncio
class TestWorkspaceCreationSecurity:
    """Regression tests for account takeover via /auth/workspaces (existing email must never be modified)."""

    async def test_existing_email_rejected_with_409(self):
        existing_id = uuid.uuid4()
        existing_email = f"victim-{existing_id.hex[:6]}@example.com"

        async with AsyncSessionLocal() as db:
            victim = User(
                id=existing_id,
                name="Original Owner",
                email=existing_email,
                password_hash=hash_password("OriginalPass#123!"),
                role=Role.advisor,
                workspace_id=None,
                is_admin=False,
            )
            db.add(victim)
            await db.commit()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/workspaces",
                json={
                    "workspace_name": "Attacker Firm",
                    "workspace_slug": f"attacker-{uuid.uuid4().hex[:6]}",
                    "admin_name": "Attacker Name",
                    "admin_email": existing_email,
                    "admin_password": "AttackerPass#456!",
                },
            )
            assert resp.status_code == 409

    async def test_existing_user_password_never_modified(self):
        existing_id = uuid.uuid4()
        existing_email = f"victim-{existing_id.hex[:6]}@example.com"
        original_password = "OriginalPass#123!"

        async with AsyncSessionLocal() as db:
            victim = User(
                id=existing_id,
                name="Original Owner",
                email=existing_email,
                password_hash=hash_password(original_password),
                role=Role.advisor,
                workspace_id=None,
                is_admin=False,
            )
            db.add(victim)
            await db.commit()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/workspaces",
                json={
                    "workspace_name": "Attacker Firm",
                    "workspace_slug": f"attacker-{uuid.uuid4().hex[:6]}",
                    "admin_name": "Attacker Name",
                    "admin_email": existing_email,
                    "admin_password": "AttackerPass#456!",
                },
            )
            assert resp.status_code == 409

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == existing_id))
            unchanged = result.scalar_one()
            assert verify_password(original_password, unchanged.password_hash) is True
            assert verify_password("AttackerPass#456!", unchanged.password_hash) is False

    async def test_existing_user_workspace_role_and_admin_never_modified(self):
        original_ws_id = uuid.uuid4()
        existing_id = uuid.uuid4()
        existing_email = f"victim-{existing_id.hex[:6]}@example.com"

        async with AsyncSessionLocal() as db:
            original_ws = Workspace(
                id=original_ws_id,
                name="Victim's Real Firm",
                slug=f"victim-firm-{original_ws_id.hex[:6]}",
            )
            db.add(original_ws)
            await db.commit()

            victim = User(
                id=existing_id,
                name="Original Owner",
                email=existing_email,
                password_hash=hash_password("OriginalPass#123!"),
                role=Role.advisor,
                workspace_id=original_ws_id,
                is_admin=False,
            )
            db.add(victim)
            await db.commit()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/workspaces",
                json={
                    "workspace_name": "Attacker Firm",
                    "workspace_slug": f"attacker-{uuid.uuid4().hex[:6]}",
                    "admin_name": "Attacker Name",
                    "admin_email": existing_email,
                    "admin_password": "AttackerPass#456!",
                },
            )
            assert resp.status_code == 409

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == existing_id))
            unchanged = result.scalar_one()
            assert unchanged.workspace_id == original_ws_id
            assert unchanged.role == Role.advisor
            assert unchanged.is_admin is False
            assert unchanged.name == "Original Owner"

    async def test_new_email_still_allows_workspace_creation(self):
        """Sanity check: the legitimate flow (brand-new email) must still work after the fix."""
        new_email = f"legit-founder-{uuid.uuid4().hex[:6]}@example.com"

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/workspaces",
                json={
                    "workspace_name": "Legit New Firm",
                    "workspace_slug": f"legit-{uuid.uuid4().hex[:6]}",
                    "admin_name": "Legit Founder",
                    "admin_email": new_email,
                    "admin_password": "LegitPass#789!",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["is_admin"] is True
            assert data["email"] == new_email