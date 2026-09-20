import pytest
import uuid
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import app
from app.database import AsyncSessionLocal
from app.core.security import create_session_token, hash_password
from models import User, Role, Workspace, SupportRequest, SupportCategory, SupportRequestStatus


@pytest.mark.asyncio
class TestSupportRequests:
    """Verifies advisor submission, admin management, and workspace scoping for Support Requests."""

    async def _make_workspace_with_advisor_and_admin(self, db):
        ws_id = uuid.uuid4()
        advisor_id = uuid.uuid4()
        admin_id = uuid.uuid4()

        ws = Workspace(id=ws_id, name="Support Test Corp", slug=f"support-test-{ws_id.hex[:6]}")
        db.add(ws)
        await db.commit()

        advisor = User(
            id=advisor_id,
            name="Support Advisor",
            email=f"advisor-{advisor_id.hex[:6]}@example.com",
            password_hash=hash_password("Pass#1234!"),
            role=Role.advisor,
            workspace_id=ws_id,
            is_admin=False,
        )
        admin = User(
            id=admin_id,
            name="Support Admin",
            email=f"admin-{admin_id.hex[:6]}@example.com",
            password_hash=hash_password("Pass#1234!"),
            role=Role.officer,
            workspace_id=ws_id,
            is_admin=True,
        )
        db.add(advisor)
        db.add(admin)
        await db.commit()

        return ws_id, advisor_id, admin_id

    async def test_advisor_can_submit_support_request(self):
        async with AsyncSessionLocal() as db:
            ws_id, advisor_id, admin_id = await self._make_workspace_with_advisor_and_admin(db)

        advisor_token = create_session_token(str(advisor_id), Role.advisor, workspace_id=str(ws_id))

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/support/requests",
                headers={"Authorization": f"Bearer {advisor_token}"},
                json={"subject": "Test ticket", "message": "Testing", "category": "general"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["subject"] == "Test ticket"
            assert data["category"] == "general"
            assert data["status"] == "submitted"

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SupportRequest).where(SupportRequest.id == uuid.UUID(data["id"])))
            row = result.scalar_one()
            assert row.advisor_id == advisor_id
            assert row.workspace_id == ws_id
            assert row.status == SupportRequestStatus.submitted

    async def test_officer_cannot_submit_support_request(self):
        """Only advisors can submit; the endpoint is gated with require_role(Role.advisor)."""
        async with AsyncSessionLocal() as db:
            ws_id, advisor_id, admin_id = await self._make_workspace_with_advisor_and_admin(db)

        officer_token = create_session_token(str(admin_id), Role.officer, workspace_id=str(ws_id), is_admin=True)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/support/requests",
                headers={"Authorization": f"Bearer {officer_token}"},
                json={"subject": "Should fail", "message": "Blocked", "category": "general"},
            )
            assert resp.status_code == 403

    async def test_admin_can_list_and_update_support_request(self):
        async with AsyncSessionLocal() as db:
            ws_id, advisor_id, admin_id = await self._make_workspace_with_advisor_and_admin(db)

        advisor_token = create_session_token(str(advisor_id), Role.advisor, workspace_id=str(ws_id))
        admin_token = create_session_token(str(admin_id), Role.officer, workspace_id=str(ws_id), is_admin=True)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            create_resp = await client.post(
                "/support/requests",
                headers={"Authorization": f"Bearer {advisor_token}"},
                json={"subject": "Needs admin review", "message": "Please check", "category": "technical_issue"},
            )
            assert create_resp.status_code == 200
            request_id = create_resp.json()["id"]

            list_resp = await client.get(
                "/support/admin/requests",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert list_resp.status_code == 200
            tickets = list_resp.json()
            assert any(t["id"] == request_id for t in tickets)

            update_resp = await client.patch(
                f"/support/admin/requests/{request_id}",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={"status": "in_progress"},
            )
            assert update_resp.status_code == 200
            assert update_resp.json()["status"] == "in_progress"

    async def test_non_admin_cannot_access_admin_endpoints(self):
        async with AsyncSessionLocal() as db:
            ws_id, advisor_id, admin_id = await self._make_workspace_with_advisor_and_admin(db)

        advisor_token = create_session_token(str(advisor_id), Role.advisor, workspace_id=str(ws_id), is_admin=False)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/support/admin/requests",
                headers={"Authorization": f"Bearer {advisor_token}"},
            )
            assert resp.status_code == 403

    async def test_support_requests_are_scoped_per_workspace(self):
        """A ticket created in workspace A must not be visible to workspace B's admin."""
        async with AsyncSessionLocal() as db:
            ws_a_id, advisor_a_id, admin_a_id = await self._make_workspace_with_advisor_and_admin(db)
            ws_b_id, advisor_b_id, admin_b_id = await self._make_workspace_with_advisor_and_admin(db)

        advisor_a_token = create_session_token(str(advisor_a_id), Role.advisor, workspace_id=str(ws_a_id))
        admin_b_token = create_session_token(str(admin_b_id), Role.officer, workspace_id=str(ws_b_id), is_admin=True)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            create_resp = await client.post(
                "/support/requests",
                headers={"Authorization": f"Bearer {advisor_a_token}"},
                json={"subject": "Workspace A only", "message": "Private to A", "category": "general"},
            )
            assert create_resp.status_code == 200
            request_id = create_resp.json()["id"]

            list_resp = await client.get(
                "/support/admin/requests",
                headers={"Authorization": f"Bearer {admin_b_token}"},
            )
            assert list_resp.status_code == 200
            tickets = list_resp.json()
            assert not any(t["id"] == request_id for t in tickets)