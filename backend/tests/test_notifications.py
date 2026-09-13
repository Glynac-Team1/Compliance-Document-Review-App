import pytest
import uuid
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.database import AsyncSessionLocal
from models import User, Role, Document, DocumentStatus, Notification, AuditEvent, Review

from sqlalchemy import delete
from app.core.security import create_session_token, hash_password


@pytest.mark.asyncio
async def test_notification_lifecycle_and_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        advisor_id = uuid.uuid4()
        officer_id = uuid.uuid4()
        doc_id = uuid.uuid4()

        try:
            async with AsyncSessionLocal() as db:
                advisor = User(
                    id=advisor_id,
                    role=Role.advisor,
                    name="Test Advisor",
                    email=f"notif-advisor-{advisor_id}@example.com",
                    password_hash=hash_password("password123"),
                )
                officer = User(
                    id=officer_id,
                    role=Role.officer,
                    name="Test Officer",
                    email=f"notif-officer-{officer_id}@example.com",
                    password_hash=hash_password("password123"),
                )
                db.add_all([advisor, officer])
                await db.commit()

                doc = Document(
                    id=doc_id,
                    advisor_id=advisor_id,
                    original_filename="financial_plan.pdf",
                    file_reference="financial_plan.pdf",
                    file_type="PDF",
                    status=DocumentStatus.pending,
                )
                db.add(doc)
                await db.commit()

            token_advisor = create_session_token(str(advisor_id), Role.advisor)
            token_officer = create_session_token(str(officer_id), Role.officer)

            # 1. Officer claims the document -> Should notify Advisor
            res_claim = await client.post(
                f"/documents/{doc_id}/claim",
                headers={"Authorization": f"Bearer {token_officer}"},
            )
            assert res_claim.status_code == 200

            # Check Advisor's notifications
            res_adv_notifs = await client.get(
                "/notifications",
                headers={"Authorization": f"Bearer {token_advisor}"},
            )
            assert res_adv_notifs.status_code == 200
            data = res_adv_notifs.json()
            assert data["unread_count"] == 1
            assert len(data["notifications"]) == 1
            assert "started reviewing" in data["notifications"][0]["message"]

            notif_id = data["notifications"][0]["id"]

            # 2. Advisor marks single notification as read
            res_read = await client.post(
                f"/notifications/{notif_id}/read",
                headers={"Authorization": f"Bearer {token_advisor}"},
            )
            assert res_read.status_code == 200
            assert res_read.json()["is_read"] is True
            assert res_read.json()["unread_count"] == 0

            # 3. Officer submits review decision -> Should notify Advisor again
            res_dec = await client.post(
                f"/documents/{doc_id}/decision",
                headers={"Authorization": f"Bearer {token_officer}"},
                json={"decision": "approve", "comment": "Complies with standard rules"},
            )
            assert res_dec.status_code == 200

            # Check Advisor's notifications again
            res_adv_notifs2 = await client.get(
                "/notifications",
                headers={"Authorization": f"Bearer {token_advisor}"},
            )
            assert res_adv_notifs2.status_code == 200
            data2 = res_adv_notifs2.json()
            assert data2["unread_count"] == 1
            assert len(data2["notifications"]) == 2
            assert "marked as approve" in data2["notifications"][0]["message"]

            # 4. Test Mark All as Read
            res_read_all = await client.post(
                "/notifications/read-all",
                headers={"Authorization": f"Bearer {token_advisor}"},
            )
            assert res_read_all.status_code == 200
            assert res_read_all.json()["unread_count"] == 0

            # Verify unread count is 0
            res_adv_notifs3 = await client.get(
                "/notifications",
                headers={"Authorization": f"Bearer {token_advisor}"},
            )
            assert res_adv_notifs3.json()["unread_count"] == 0

            # 5. Test GET /documents/{id} for advisor and officer
            res_get_adv = await client.get(
                f"/documents/{doc_id}",
                headers={"Authorization": f"Bearer {token_advisor}"},
            )
            assert res_get_adv.status_code == 200
            assert res_get_adv.json()["id"] == str(doc_id)
            assert res_get_adv.json()["filename"] == "financial_plan.pdf"

            res_get_off = await client.get(
                f"/documents/{doc_id}",
                headers={"Authorization": f"Bearer {token_officer}"},
            )
            assert res_get_off.status_code == 200
            assert res_get_off.json()["id"] == str(doc_id)

        finally:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(Notification).where(Notification.user_id.in_([advisor_id, officer_id])))
                await db.execute(delete(AuditEvent).where(AuditEvent.document_id == doc_id))
                await db.execute(delete(Review).where(Review.document_id == doc_id))
                await db.execute(delete(Document).where(Document.id == doc_id))
                await db.execute(delete(AuditEvent).where(AuditEvent.actor_id.in_([advisor_id, officer_id])))
                await db.execute(delete(User).where(User.id.in_([advisor_id, officer_id])))
                await db.commit()

