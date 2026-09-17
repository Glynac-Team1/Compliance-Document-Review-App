from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.documents import router as documents_router
from app.api.roles import officer_router, advisor_router
from app.api.auth import router as auth_router
from app.api.notifications import router as notifications_router
from app.api.invitations import router as invitations_router

from fastapi.responses import JSONResponse

app = FastAPI(title="Compliance Document Review API")

# Allow Next.js frontend across localhost, IP, and remote environments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"http://.*:3000",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(invitations_router, tags=["invitations"])
app.include_router(advisor_router, prefix="/documents/mine", tags=["advisor"])
app.include_router(documents_router, prefix="/documents", tags=["documents"])
app.include_router(officer_router, prefix="/queue", tags=["officer"])
app.include_router(notifications_router, prefix="/notifications", tags=["notifications"])



@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
