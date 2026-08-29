clea# ---- Stage 1: build dependencies in an isolated layer ----
FROM python:3.12-slim AS builder

WORKDIR /build

# System deps needed only to *compile* certain wheels (e.g. psycopg/asyncpg extras)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ---- Stage 2: slim runtime image ----
FROM python:3.12-slim

WORKDIR /app

# Runtime-only system deps (no compilers) + curl for the healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Bring in only the installed Python packages from the builder stage
COPY --from=builder /install /usr/local

# Create a non-root user to run the app
RUN useradd --create-home --uid 1000 appuser
USER appuser

COPY --chown=appuser:appuser . .

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
