FROM python:3.12-slim AS builder

WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend-requirements.txt
COPY worker/requirements.txt ./worker-requirements.txt
RUN pip install --no-cache-dir --prefix=/install -r backend-requirements.txt -r worker-requirements.txt

FROM python:3.12-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
RUN useradd --create-home --uid 1000 appuser

COPY --chown=appuser:appuser backend/app ./app
COPY --chown=appuser:appuser backend/models ./models
COPY --chown=appuser:appuser backend/alembic ./alembic
COPY --chown=appuser:appuser backend/alembic.ini ./alembic.ini
COPY --chown=appuser:appuser backend/entrypoint.sh ./entrypoint.sh
COPY --chown=appuser:appuser worker ./worker

RUN chmod +x ./entrypoint.sh
USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/home/appuser/.cache/huggingface

ENTRYPOINT ["./entrypoint.sh"]
CMD ["celery", "-A", "worker.celery_app.celery_app", "worker", "--loglevel=info"]