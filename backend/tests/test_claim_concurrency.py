import pytest
import uuid
import asyncio
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.database import AsyncSessionLocal
from models import User, Role, Document, DocumentStatus, Review, AuditEvent, Notification

from sqlalchemy import delete
from datetime import datetime, timezone, timedelta
from app.core.security import create_session_token, hash_password


@pytest.mark.asyncio
async def test_claim_lock_and_review_concurrency():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        advisor_id = uuid.uuid4()
        officer1_id = uuid.uuid4()
        officer2_id = uuid.uuid4()
        doc1_id = uuid.uuid4()
        doc2_id = uuid.uuid4()

        try:
            async with AsyncSessionLocal() as db:
                advisor = User(
                    id=advisor_id,
                    role=Role.advisor,
                    name="Test Advisor",
                    email=f"advisor-{advisor_id}@example.com",
                    password_hash=hash_password("password123"),
                )
                officer1 = User(
                    id=officer1_id,
                    role=Role.officer,
                    name="Officer Alice",
                    email=f"alice-{officer1_id}@example.com",
                    password_hash=hash_password("password123"),
                )
                officer2 = User(
                    id=officer2_id,
                    role=Role.officer,
                    name="Officer Bob",
                    email=f"bob-{officer2_id}@example.com",
                    password_hash=hash_password("password123"),
                )
                db.add_all([advisor, officer1, officer2])
                await db.commit()

                doc1 = Document(
                    id=doc1_id,
                    advisor_id=advisor_id,
                    original_filename="audit_portfolio.pdf",
                    file_reference="audit_portfolio.pdf",
                    file_type="PDF",
                    status=DocumentStatus.pending,
                )
                db.add(doc1)
                await db.commit()

            token_officer1 = create_session_token(str(officer1_id), Role.officer)
            token_officer2 = create_session_token(str(officer2_id), Role.officer)

            # 1. Officer 1 claims doc1 -> Success
            res1 = await client.post(
                f"/documents/{doc1_id}/claim",
                headers={"Authorization": f"Bearer {token_officer1}"},
            )
            assert res1.status_code == 200
            assert res1.json()["status"] == "in_review"
            assert res1.json()["locked_by_officer_id"] == str(officer1_id)

            # 2. Officer 1 claims again -> Idempotent success
            res1_again = await client.post(
                f"/documents/{doc1_id}/claim",
                headers={"Authorization": f"Bearer {token_officer1}"},
            )
            assert res1_again.status_code == 200

            # 3. Officer 2 attempts to claim doc1 -> 409 Conflict
            res2 = await client.post(
                f"/documents/{doc1_id}/claim",
                headers={"Authorization": f"Bearer {token_officer2}"},
            )
            assert res2.status_code == 409
            assert "Officer Alice" in res2.json()["detail"]

            # 4. Officer 2 attempts to submit a review without holding the lock -> 409 Conflict
            res2_review = await client.post(
                f"/queue/{doc1_id}/review",
                headers={"Authorization": f"Bearer {token_officer2}"},
                json={"decision": "reject", "comment": "Officer Bob attempting illegal review"},
            )
            assert res2_review.status_code == 409

            # 5. Check queue listing as Officer 2 -> reflects locked_by_other
            res_queue = await client.get(
                "/queue",
                headers={"Authorization": f"Bearer {token_officer2}"},
            )
            assert res_queue.status_code == 200
            queue_docs = res_queue.json()["documents"]
            doc_in_queue = next((d for d in queue_docs if d["id"] == str(doc1_id)), None)
            assert doc_in_queue is not None
            assert doc_in_queue["is_locked_by_other"] is True
            assert doc_in_queue["is_locked_by_me"] is False
            assert doc_in_queue["locked_by_officer_name"] == "Officer Alice"

            # 6. Officer 1 submits the review -> Success and lock released
            res1_review = await client.post(
                f"/queue/{doc1_id}/review",
                headers={"Authorization": f"Bearer {token_officer1}"},
                json={"decision": "approve", "comment": "Officer Alice valid review determination"},
            )
            assert res1_review.status_code == 200
            assert res1_review.json()["status"] == "approved"

            async with AsyncSessionLocal() as db:
                updated_doc = await db.get(Document, doc1_id)
                assert updated_doc.status == DocumentStatus.approved
                assert updated_doc.locked_by_officer_id is None

            # 7. Test Release endpoint
            async with AsyncSessionLocal() as db:
                doc2 = Document(
                    id=doc2_id,
                    advisor_id=advisor_id,
                    original_filename="risk_assessment.pdf",
                    file_reference="risk_assessment.pdf",
                    file_type="PDF",
                    status=DocumentStatus.pending,
                )
                db.add(doc2)
                await db.commit()

            # Officer 1 claims doc2
            await client.post(
                f"/documents/{doc2_id}/claim",
                headers={"Authorization": f"Bearer {token_officer1}"},
            )

            # Officer 2 tries to release doc2 -> 403 Forbidden
            res_unauth = await client.post(
                f"/documents/{doc2_id}/release",
                headers={"Authorization": f"Bearer {token_officer2}"},
            )
            assert res_unauth.status_code == 403

            # Officer 1 releases doc2 -> 200 OK and status returns to pending
            res_release = await client.post(
                f"/documents/{doc2_id}/release",
                headers={"Authorization": f"Bearer {token_officer1}"},
            )
            assert res_release.status_code == 200
            assert res_release.json()["status"] == "pending"

            # Officer 2 can now claim doc2
            res2_claim = await client.post(
                f"/documents/{doc2_id}/claim",
                headers={"Authorization": f"Bearer {token_officer2}"},
            )
            assert res2_claim.status_code == 200
            assert res2_claim.json()["locked_by_officer_id"] == str(officer2_id)

            # 8. Test Heartbeat & TTL Expiration Takeover
            # Officer 2 currently holds lock on doc2. Send heartbeat -> 200 OK
            res_hb = await client.post(
                f"/documents/{doc2_id}/heartbeat",
                headers={"Authorization": f"Bearer {token_officer2}"},
            )
            assert res_hb.status_code == 200
            assert "locked_at" in res_hb.json()

            # Officer 1 attempts heartbeat on doc2 -> 409 Conflict
            res_hb_unauth = await client.post(
                f"/documents/{doc2_id}/heartbeat",
                headers={"Authorization": f"Bearer {token_officer1}"},
            )
            assert res_hb_unauth.status_code == 409

            # Simulate Officer 2 going idle past TTL (e.g. 35 minutes ago)
            async with AsyncSessionLocal() as db:
                expired_time = datetime.now(timezone.utc) - timedelta(minutes=35)
                doc_to_expire = await db.get(Document, doc2_id)
                doc_to_expire.locked_at = expired_time
                await db.commit()

            # In queue, doc2 should now be considered unlocked
            res_queue_expired = await client.get(
                "/queue",
                headers={"Authorization": f"Bearer {token_officer1}"},
            )
            assert res_queue_expired.status_code == 200
            doc2_in_queue = next((d for d in res_queue_expired.json()["documents"] if d["id"] == str(doc2_id)), None)
            assert doc2_in_queue is not None
            assert doc2_in_queue["is_locked_by_other"] is False
            assert doc2_in_queue["status"] == "pending"

            # Officer 1 can now take over the expired lock
            res1_takeover = await client.post(
                f"/documents/{doc2_id}/claim",
                headers={"Authorization": f"Bearer {token_officer1}"},
            )
            assert res1_takeover.status_code == 200
            assert res1_takeover.json()["locked_by_officer_id"] == str(officer1_id)

            # Officer 2 attempts heartbeat now -> 409 Conflict (lost lock)
            res2_lost_hb = await client.post(
                f"/documents/{doc2_id}/heartbeat",
                headers={"Authorization": f"Bearer {token_officer2}"},
            )
            assert res2_lost_hb.status_code == 409

        finally:

            # Teardown: purge all test records from DB so dev DB remains clean
            async with AsyncSessionLocal() as db:
                await db.execute(delete(Notification).where(Notification.document_id.in_([doc1_id, doc2_id])))
                await db.execute(delete(Review).where(Review.document_id.in_([doc1_id, doc2_id])))
                await db.execute(delete(AuditEvent).where(AuditEvent.document_id.in_([doc1_id, doc2_id])))
                await db.execute(delete(Document).where(Document.id.in_([doc1_id, doc2_id])))
                await db.execute(delete(AuditEvent).where(AuditEvent.actor_id.in_([advisor_id, officer1_id, officer2_id])))
                await db.execute(delete(User).where(User.id.in_([advisor_id, officer1_id, officer2_id])))
                await db.commit()



@pytest.mark.asyncio
async def test_true_concurrent_claim_only_one_succeeds():
    """Fires two claim requests at the exact same time via asyncio.gather.
    Exactly one must succeed (200) and the other must get 409 — this is what
    actually exercises the race condition, unlike sequential awaited calls."""
    advisor_id = uuid.uuid4()
    officer1_id = uuid.uuid4()
    officer2_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    try:
        async with AsyncSessionLocal() as db:
            advisor = User(
                id=advisor_id,
                role=Role.advisor,
                name="Concurrency Advisor",
                email=f"advisor-{advisor_id}@example.com",
                password_hash=hash_password("password123"),
            )
            officer1 = User(
                id=officer1_id,
                role=Role.officer,
                name="Officer Racer1",
                email=f"racer1-{officer1_id}@example.com",
                password_hash=hash_password("password123"),
            )
            officer2 = User(
                id=officer2_id,
                role=Role.officer,
                name="Officer Racer2",
                email=f"racer2-{officer2_id}@example.com",
                password_hash=hash_password("password123"),
            )
            db.add_all([advisor, officer1, officer2])
            await db.commit()

            doc = Document(
                id=doc_id,
                advisor_id=advisor_id,
                original_filename="race_condition_test.pdf",
                file_reference="race_condition_test.pdf",
                file_type="PDF",
                status=DocumentStatus.pending,
            )
            db.add(doc)
            await db.commit()

        token1 = create_session_token(str(officer1_id), Role.officer)
        token2 = create_session_token(str(officer2_id), Role.officer)

        # Two genuinely concurrent HTTP clients, firing at the same time via gather.
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client1, \
                   AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client2:

            res1, res2 = await asyncio.gather(
                client1.post(f"/documents/{doc_id}/claim", headers={"Authorization": f"Bearer {token1}"}),
                client2.post(f"/documents/{doc_id}/claim", headers={"Authorization": f"Bearer {token2}"}),
            )

        statuses = sorted([res1.status_code, res2.status_code])
        assert statuses == [200, 409], f"Expected exactly one 200 and one 409, got {statuses}"

        # Confirm the DB ended up in a consistent state: locked by exactly one officer.
        async with AsyncSessionLocal() as db:
            final_doc = await db.get(Document, doc_id)
            assert final_doc.locked_by_officer_id in (officer1_id, officer2_id)
            assert final_doc.status == DocumentStatus.in_review

    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Notification).where(Notification.document_id == doc_id))
            await db.execute(delete(Review).where(Review.document_id == doc_id))
            await db.execute(delete(AuditEvent).where(AuditEvent.document_id == doc_id))
            await db.execute(delete(Document).where(Document.id == doc_id))
            await db.execute(delete(AuditEvent).where(AuditEvent.actor_id.in_([advisor_id, officer1_id, officer2_id])))
            await db.execute(delete(User).where(User.id.in_([advisor_id, officer1_id, officer2_id])))
            await db.commit()


@pytest.mark.asyncio
async def test_expired_lock_can_still_be_reclaimed_atomically():
    """Confirms the atomic UPDATE's WHERE clause correctly allows takeover
    when the existing lock has expired (not just when it's absent)."""
    advisor_id = uuid.uuid4()
    officer1_id = uuid.uuid4()
    officer2_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    try:
        async with AsyncSessionLocal() as db:
            advisor = User(
                id=advisor_id,
                role=Role.advisor,
                name="Expiry Advisor",
                email=f"advisor-{advisor_id}@example.com",
                password_hash=hash_password("password123"),
            )
            officer1 = User(
                id=officer1_id,
                role=Role.officer,
                name="Officer Stale",
                email=f"stale-{officer1_id}@example.com",
                password_hash=hash_password("password123"),
            )
            officer2 = User(
                id=officer2_id,
                role=Role.officer,
                name="Officer Fresh",
                email=f"fresh-{officer2_id}@example.com",
                password_hash=hash_password("password123"),
            )
            db.add_all([advisor, officer1, officer2])
            await db.commit()

            expired_time = datetime.now(timezone.utc) - timedelta(minutes=35)
            doc = Document(
                id=doc_id,
                advisor_id=advisor_id,
                original_filename="expired_lock_test.pdf",
                file_reference="expired_lock_test.pdf",
                file_type="PDF",
                status=DocumentStatus.in_review,
                locked_by_officer_id=officer1_id,
                locked_at=expired_time,
            )
            db.add(doc)
            await db.commit()

        token2 = create_session_token(str(officer2_id), Role.officer)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                f"/documents/{doc_id}/claim",
                headers={"Authorization": f"Bearer {token2}"},
            )
            assert res.status_code == 200
            assert res.json()["locked_by_officer_id"] == str(officer2_id)

    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Notification).where(Notification.document_id == doc_id))
            await db.execute(delete(Review).where(Review.document_id == doc_id))
            await db.execute(delete(AuditEvent).where(AuditEvent.document_id == doc_id))
            await db.execute(delete(Document).where(Document.id == doc_id))
            await db.execute(delete(AuditEvent).where(AuditEvent.actor_id.in_([advisor_id, officer1_id, officer2_id])))
            await db.execute(delete(User).where(User.id.in_([advisor_id, officer1_id, officer2_id])))
            await db.commit()

