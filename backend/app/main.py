# backend/app/main.py
from fastapi import FastAPI

app = FastAPI(title="Compliance Document Review API")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
