# core logic, upload endpoint
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from app.core.security import require_role
from app.models import Role, DocumentStatus
from app.config import settings
import magic

router = APIRouter()


@router.post("")
async def upload_document(file: UploadFile, _: dict = Depends(require_role(Role.advisor))):
    contents = await file.read()
    if len(contents) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, "File too large")

    mime = magic.from_buffer(contents, mime=True)
    if mime not in settings.allowed_mime_types:
        raise HTTPException(415, f"Unsupported file type: {mime}")

    # save file, insert Document row (status=pending_review),
    # enqueue analyze_document(document_id) — see Part 8
