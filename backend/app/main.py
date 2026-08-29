from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.documents import router as documents_router
from app.api.roles import officer_router, advisor_router

app = FastAPI(title="Compliance Document Review API")

# Allow Next.js frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents_router, prefix="/documents", tags=["documents"])
app.include_router(officer_router, prefix="/queue", tags=["officer"])
app.include_router(advisor_router, prefix="/documents/mine", tags=["advisor"])


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
