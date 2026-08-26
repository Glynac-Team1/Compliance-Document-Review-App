from celery import Celery

from app.config import settings

celery_app = Celery("compliance_review", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_default_queue = "document-analysis"


@celery_app.task
def analyze_document(document_id: str) -> dict:
    """Pipeline entry point for extraction, masking, and AI analysis."""
    return {"document_id": document_id, "status": "pending"}
