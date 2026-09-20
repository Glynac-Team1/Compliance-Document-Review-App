import pytest
import uuid
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.database import AsyncSessionLocal
from models import (
    User,
    Role,
    Document,
    DocumentStatus,
    Review,
    Decision,
    AIAnalysis,
    AnalysisStatus,
    AuditEvent,
    Notification,
)
from sqlalchemy import select, delete
from app.core.security import create_session_token, hash_password


@pytest.mark.asyncio
async def test_decision_state_machine_and_review_immutability():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        advisor_id = uuid.uuid4()
        officer_id = uuid.uuid4()
        doc_pending_id = uuid.uuid4()
        doc_revision_id = uuid.uuid4()

        try:
            async with AsyncSessionLocal() as db:
                advisor = User(
                    id=advisor_id,
                    role=Role.advisor,
                    name="Test Advisor",
                    email=f"adv-{advisor_id}@example.com",
                    password_hash=hash_password("password123"),
                )
                officer = User(
                    id=officer_id,
                    role=Role.officer,
                    name="Test Officer",
                    email=f"off-{officer_id}@example.com",
                    password_hash=hash_password("password123"),
                )
                db.add_all([advisor, officer])
                await db.commit()

                doc_pending = Document(
                    id=doc_pending_id,
                    advisor_id=advisor_id,
                    original_filename="initial_doc.pdf",
                    file_reference="initial_doc.pdf",
                    file_type="PDF",
                    status=DocumentStatus.pending,
                )
                doc_revision = Document(
                    id=doc_revision_id,
                    advisor_id=advisor_id,
                    original_filename="revision_doc.pdf",
                    file_reference="revision_doc.pdf",
                    file_type="PDF",
                    status=DocumentStatus.needs_revision,
                )
                db.add_all([doc_pending, doc_revision])
                await db.commit()

            officer_token = create_session_token(str(officer_id), Role.officer)
            headers = {"Authorization": f"Bearer {officer_token}"}

            # 1. Attempting to decide on a document that is already needs_revision -> 409
            res_rev = await client.post(
                f"/documents/{doc_revision_id}/decision",
                json={"decision": "approve", "comment": "Trying to approve revised directly"},
                headers=headers,
            )
            assert res_rev.status_code == 409
            assert "already marked as needs revision" in res_rev.json()["detail"]

            # 2. Decision on pending document -> 200 Success
            res_decide1 = await client.post(
                f"/documents/{doc_pending_id}/decision",
                json={"decision": "approve", "comment": "First decision approval"},
                headers=headers,
            )
            assert res_decide1.status_code == 200
            assert res_decide1.json()["status"] == "approved"

            # Verify review row created
            async with AsyncSessionLocal() as db:
                rev = await db.scalar(select(Review).where(Review.document_id == doc_pending_id))
                assert rev is not None
                assert rev.decision == Decision.approve
                assert rev.comment == "First decision approval"

            # 3. Attempting to decide again on approved document -> 409
            res_decide2 = await client.post(
                f"/documents/{doc_pending_id}/decision",
                json={"decision": "reject", "comment": "Attempting second decision"},
                headers=headers,
            )
            assert res_decide2.status_code == 409
            assert "cannot be decided again" in res_decide2.json()["detail"]

            # Verify review row was NOT overwritten
            async with AsyncSessionLocal() as db:
                rev_after = await db.scalar(select(Review).where(Review.document_id == doc_pending_id))
                assert rev_after is not None
                assert rev_after.decision == Decision.approve
                assert rev_after.comment == "First decision approval"

        finally:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(Notification).where(Notification.document_id.in_([doc_pending_id, doc_revision_id])))
                await db.execute(delete(Review).where(Review.document_id.in_([doc_pending_id, doc_revision_id])))
                await db.execute(delete(AuditEvent).where(AuditEvent.document_id.in_([doc_pending_id, doc_revision_id])))
                await db.execute(delete(Document).where(Document.id.in_([doc_pending_id, doc_revision_id])))
                await db.execute(delete(AuditEvent).where(AuditEvent.actor_id.in_([advisor_id, officer_id])))
                await db.execute(delete(User).where(User.id.in_([advisor_id, officer_id])))
                await db.commit()


@pytest.mark.asyncio
async def test_document_thread_batch_query():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        advisor_id = uuid.uuid4()
        officer_id = uuid.uuid4()
        v1_id = uuid.uuid4()
        v2_id = uuid.uuid4()
        ai_v1_id = uuid.uuid4()

        try:
            async with AsyncSessionLocal() as db:
                advisor = User(
                    id=advisor_id,
                    role=Role.advisor,
                    name="Thread Advisor",
                    email=f"t-adv-{advisor_id}@example.com",
                    password_hash=hash_password("password123"),
                )
                officer = User(
                    id=officer_id,
                    role=Role.officer,
                    name="Reviewing Officer",
                    email=f"t-off-{officer_id}@example.com",
                    password_hash=hash_password("password123"),
                )
                db.add_all([advisor, officer])
                await db.commit()

                # V1 document (needs_revision)
                v1_doc = Document(
                    id=v1_id,
                    advisor_id=advisor_id,
                    original_filename="investment_deck_v1.pdf",
                    file_reference="investment_deck_v1.pdf",
                    file_type="PDF",
                    status=DocumentStatus.needs_revision,
                    thread_root_id=None,
                )
                # V2 document (in_review)
                v2_doc = Document(
                    id=v2_id,
                    advisor_id=advisor_id,
                    original_filename="investment_deck_v2.pdf",
                    file_reference="investment_deck_v2.pdf",
                    file_type="PDF",
                    status=DocumentStatus.pending,
                    previous_version_id=v1_id,
                    thread_root_id=v1_id,
                )
                db.add_all([v1_doc, v2_doc])
                await db.commit()

                # V1 has a Review and an AIAnalysis
                rev_v1 = Review(
                    document_id=v1_id,
                    officer_id=officer_id,
                    decision=Decision.needs_revision,
                    comment="Please revise disclosure page 3.",
                )
                ai_v1 = AIAnalysis(
                    id=ai_v1_id,
                    document_id=v1_id,
                    summary="Potential disclaimer omission.",
                    status=AnalysisStatus.ready,
                )
                db.add_all([rev_v1, ai_v1])
                await db.commit()

            advisor_token = create_session_token(str(advisor_id), Role.advisor)
            headers = {"Authorization": f"Bearer {advisor_token}"}

            # Query the thread for v2 (or v1)
            res = await client.get(f"/documents/{v2_id}/thread", headers=headers)
            assert res.status_code == 200
            data = res.json()

            assert data["thread_root_id"] == str(v1_id)
            assert data["total_versions"] == 2
            assert len(data["versions"]) == 2

            # Check Version 1
            v1_data = data["versions"][0]
            assert v1_data["version"] == 1
            assert v1_data["document_id"] == str(v1_id)
            assert v1_data["filename"] == "investment_deck_v1.pdf"
            assert v1_data["status"] == "needs_revision"
            assert v1_data["review"] is not None
            assert v1_data["review"]["decision"] == "needs_revision"
            assert v1_data["review"]["comment"] == "Please revise disclosure page 3."
            assert v1_data["review"]["officer_name"] == "Reviewing Officer"
            assert v1_data["ai_analysis"] is not None
            assert v1_data["ai_analysis"]["status"] == "ready"
            assert v1_data["ai_analysis"]["summary"] == "Potential disclaimer omission."

            # Check Version 2
            v2_data = data["versions"][1]
            assert v2_data["version"] == 2
            assert v2_data["document_id"] == str(v2_id)
            assert v2_data["filename"] == "investment_deck_v2.pdf"
            assert v2_data["previous_version_id"] == str(v1_id)
            assert v2_data["review"] is None
            assert v2_data["ai_analysis"] is None

        finally:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(AIAnalysis).where(AIAnalysis.id == ai_v1_id))
                await db.execute(delete(Review).where(Review.document_id.in_([v1_id, v2_id])))
                await db.execute(delete(Document).where(Document.id.in_([v1_id, v2_id])))
                await db.execute(delete(User).where(User.id.in_([advisor_id, officer_id])))
                await db.commit()
