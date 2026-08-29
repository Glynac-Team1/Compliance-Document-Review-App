# core logic, upload endpoint
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from app.core.security import require_role
from app.models import Role, DocumentStatus
from app.config import settings
import magic

router = APIRouter()


@router.post("")
async def upload_document(file: UploadFile, _: dict = Depends(require_role(Role.advisor))):
    # SECURITY FIX: Do not use `await file.read()` directly.
    # It loads the entire file into RAM before the size check, which allows OOM attacks.
    MAX_SIZE = settings.max_upload_mb * 1024 * 1024
    file_size = 0
    contents = bytearray()

    # Read the file in 1MB chunks to safely enforce the limit
    while chunk := await file.read(1024 * 1024):
        file_size += len(chunk)
        if file_size > MAX_SIZE:
            raise HTTPException(413, f"File too large. Maximum size is {settings.max_upload_mb}MB.")
        contents.extend(chunk)

    mime = magic.from_buffer(contents, mime=True)
    if mime not in settings.allowed_mime_types:
        raise HTTPException(415, f"Unsupported file type: {mime}")

    # TODO: Stream contents to MinIO and insert into Postgres here.
    
    # Notice we return 'pending', matching our locking architecture, 
    # rather than the teammate's 'pending_review'
    return {"status": "pending", "filename": file.filename}
