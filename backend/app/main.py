# backend/app/main.py
from fastapi import FastAPI
from app.api.documents import router as documents_router
from app.api.roles import officer_router, advisor_router
from app.api.auth import auth_router

app = FastAPI(title="Compliance Document Review API")
app.include_router(documents_router, prefix="/documents", tags=["documents"])
app.include_router(officer_router, prefix="/queue", tags=["officer"])
app.include_router(advisor_router, prefix="/documents/mine", tags=["advisor"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
