from fastapi import APIRouter, Depends

from app.core.security import require_role
from app.models import Role


advisor_router = APIRouter()
officer_router = APIRouter()


@advisor_router.get("")
async def list_my_documents(_: dict = Depends(require_role(Role.advisor))) -> dict:
    return {"documents": []}


@officer_router.get("")
async def list_review_queue(_: dict = Depends(require_role(Role.officer))) -> dict:
    return {"documents": []}
