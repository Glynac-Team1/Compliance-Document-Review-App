# backend/app/main.py
from fastapi import FastAPI
from app.api.documents import router as documents_router
from app.api.roles import officer_router, advisor_router

app = FastAPI(title="Compliance Document Review API")
app.include_router(documents_router, prefix="/documents", tags=["documents"])
app.include_router(officer_router, prefix="/queue", tags=["officer"])
app.include_router(advisor_router, prefix="/documents/mine", tags=["advisor"])


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
