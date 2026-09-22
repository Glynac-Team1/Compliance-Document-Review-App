import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.api.documents import (
    ANALYSIS_ENQUEUE_MAX_ATTEMPTS,
    enqueue_analysis,
    mark_enqueue_failed,
)
from app.core.analysis_errors import AnalysisErrorCode, get_user_facing_message
from models import AnalysisStatus


@pytest.mark.asyncio
async def test_enqueue_analysis_succeeds_without_retry():
    document_id = uuid.uuid4()
    with patch("app.api.documents.celery_client.send_task") as send_task:
        assert await enqueue_analysis(document_id) is True

    send_task.assert_called_once_with(
        "worker.celery_app.analyze_document",
        args=[str(document_id)],
        queue="document-analysis",
    )


@pytest.mark.asyncio
async def test_enqueue_analysis_stops_after_bounded_attempts():
    document_id = uuid.uuid4()
    with (
        patch(
            "app.api.documents.celery_client.send_task",
            side_effect=ConnectionError("redis unavailable"),
        ) as send_task,
        patch("app.api.documents.asyncio.sleep", new_callable=AsyncMock),
    ):
        assert await enqueue_analysis(document_id) is False

    assert send_task.call_count == ANALYSIS_ENQUEUE_MAX_ATTEMPTS


@pytest.mark.asyncio
async def test_mark_enqueue_failed_persists_retryable_operator_state():
    document_id = uuid.uuid4()
    analysis = MagicMock(
        status=AnalysisStatus.pending,
        error_code=None,
        error_message=None,
        user_facing_error=None,
        technical_error=None,
        summary=None,
    )
    document = MagicMock(ai_analysis=None)
    db = MagicMock()
    db.scalar = AsyncMock(side_effect=[analysis, document])
    db.commit = AsyncMock()

    await mark_enqueue_failed(db, document_id)

    assert analysis.status == AnalysisStatus.error
    assert analysis.error_code == AnalysisErrorCode.ANALYSIS_ENQUEUE_FAILED.value
    assert document.ai_analysis["manual_review_required"] is True
    db.commit.assert_awaited_once()


def test_enqueue_failure_message_explains_recovery():
    message = get_user_facing_message(AnalysisErrorCode.ANALYSIS_ENQUEUE_FAILED)
    assert "queued" in message
    assert "retry" in message