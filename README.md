# Compliance Document Review App

A web application that replaces ad-hoc compliance review with a shared queue, an immutable audit trail, and an AI assist panel that flags issues (missing disclosures, inconsistent claims, missing signatures) without ever making the decision itself. The human compliance officer always makes the final call.

Built as a 4-week intern glynac project across five tracks: Backend, Frontend, AI, Data Engineering, DevOps/Platform.

See also: [`docs/technical-implementation-plan.md`](./docs/technical-implementation-plan.md) for detailed per-track scope, and [`docs/architecture.md`](./docs/architecture.md) for system and data/AI diagrams.

---

## Engineering Team & Core Track Ownership

| Team Member | Track | Specialization & Key Responsibilities |
|---|---|---|
| **Basamsetti Venkata Vamsi** | **AI Engineering** | PII masking pipelines (Presidio + custom regex), prompt engineering, structured JSON schema enforcement, and third-party LLM integrations (Gemini / Groq). |
| **Kashish Agarwal** | **Backend Engineering** | FastAPI REST endpoints, session/role auth enforcement (server-side 403 gates), document lifecycle state machine, and Celery/Redis background task orchestration. |
| **Daniel Ojo** | **Frontend Engineering** | Next.js 16 (App Router, Turbopack) + TypeScript SPA, split-pane review interface, Server-Sent Events (SSE) live sync, role-gated routes, and responsive UI/UX for loading & degraded states. |
| **Jemarco Briz** | **Data Engineering** | Format-aware text extraction (PDF/DOCX/XLSX), local vector embeddings (`BAAI/bge-small-en-v1.5`), `pgvector` HNSW index architecture, and the 3-phase retrieval engine. |
| **Cross-Track / Shared** | **DevOps & Platform** | Docker Compose orchestration, automated Alembic migration & seeding scripts on boot, environment controls, and GitHub Actions CI pipelines. |

---

## What it does

- **Advisors** submit documents and track their status and feedback.
- **Compliance Officers** work a filterable queue, review each document alongside an AI-generated summary and rule-linked flags, and record Approve / Reject / Needs Revision with a comment.
- **Needs Revision** loops back to the advisor; the resubmission is linked to the original as one thread.
- Every action is recorded in an append-only audit log.
- All document text is PII-masked **before** it ever reaches a third-party AI provider.

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack) + TypeScript, Tailwind CSS v4, Lucide React, Vitest, Server-Sent Events (SSE) |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Celery + Redis |
| Database | PostgreSQL 16 + `pgvector` (HNSW index) |
| AI | Gemini API (Google AI Studio free tier) or Groq — no production Anthropic credits |
| PII Masking | Microsoft Presidio + custom regex recognizers |
| Embeddings | Local `sentence-transformers` (`BAAI/bge-small-en-v1.5`) — never sent to a third party |
| Infra | Docker Compose, GitHub Actions CI |

### Frontend & Real-Time Architecture Highlights

- **Next.js 16 (Turbopack & App Router)**: Component-driven architecture built with strict TypeScript enforcement (`tsc --noEmit`), eliminating build error suppressions.
- **Server-Sent Events (SSE) Live Sync**: Native real-time streaming via `useLiveSync` connecting to `/notifications/stream` and `/documents/stream`, automatically refreshing queues and review states without continuous client polling.
- **Resilient AI Degradation**: Explicit UI handling for missing, partial, or failed AI analyses (`ai_status: "failed"` / `"pending"`), allowing compliance officers to proceed with manual reviews uninterrupted.
- **Institutional Toast System**: Non-blocking, accessible visual feedback mounted globally at root layout (`frontend/components/Toast.tsx`), replacing default browser alerts with professional status messaging.
- **Testing & Verification**: Vitest and `@testing-library/react` test suites verifying component resilience and degraded state handling (`frontend/__tests__/degraded-state.test.tsx`), accompanied by ESLint flat config.

Full rationale for each choice is in [`docs/technical-implementation-plan.md §4`](./docs/technical-implementation-plan.md#4-tech-stack-by-track).

---

## Getting Started

This project is designed to run with Docker Compose so every teammate uses the same
PostgreSQL, Redis, backend, worker, and frontend versions.

### Prerequisites

Install the following on your laptop:

- Git
- Docker Engine or Docker Desktop with Compose v2
- At least 4 GB of available memory for the containers
- An LLM API key for AI features. Google AI Studio/Gemini is the recommended provider.

Check the installations:

```bash
git --version
docker --version
docker compose version


### 1. Clone the repository

Replace `<repository-url>` with the repository URL provided by the team:

```bash
git clone <repository-url>
cd Compliance-Document-Review-App
```

### 2. Create the local environment file

`.env.example` is the shared configuration template. Copy it to `.env`; never commit
`.env` or put real API keys in source files.

```bash
cp .env.example .env
```

Open `.env` and set at least these values:

```dotenv
LLM_API_KEY=your-provider-api-key
LLM_PROVIDER=gemini
SESSION_SECRET=replace-with-a-long-random-value
```

Supported provider values are `gemini` and `groq`. Leave `LLM_API_KEY` empty when
working only on the non-AI scaffold; the API can still start, but AI analysis will
not be available.

The Compose file supplies the container-internal database and Redis URLs. Do not
replace `DATABASE_URL` with `localhost` for the Docker workflow: inside the backend
container, the database hostname is `postgres` and the Redis hostname is `redis`.

### 3. Start the complete environment

Build the images and start all services:

```bash
docker compose up --build
```

The first run downloads the base images and Python/Node dependencies and may take a
few minutes. Keep this terminal open to see application logs. To start in the
background instead:

```bash
docker compose up --build -d
docker compose logs -f backend
```

The backend waits for healthy Postgres and Redis services. Its entrypoint then runs
`alembic upgrade head` before starting Uvicorn. The initial database migration creates
the users table; later migrations will extend the schema.

### 4. Open the services

Once the containers are running, use:

| Service | URL | Purpose |
|---|---|---|
| Frontend | <http://localhost:3000> | Next.js application |
| Backend API | <http://localhost:8000> | FastAPI API |
| API docs | <http://localhost:8000/docs> | Interactive Swagger UI |
| Health check | <http://localhost:8000/health> | Backend readiness check |

Verify the backend from a second terminal:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"ok"}
```

### 5. Run the checks

Backend tests use the repository virtual environment and do not require a live
database for the role-boundary tests:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
PYTHONPATH=backend .venv/bin/pytest -q
```

Build and verify the frontend locally:

```bash
cd frontend
npm install
npm run lint    # ESLint check (0 errors, 0 warnings)
npm test        # Vitest unit test suite (degraded AI states & fallback handling)
npm run build   # Next.js production build with strict TypeScript type-checking
cd ..
```

The same frontend dependencies are installed automatically when the frontend Docker
image is built.

### Local development without Docker

Docker Compose remains the recommended workflow. If you run the backend directly,
start Postgres/Redis first and use host-facing URLs. The repository's development
Postgres container uses port `5433` because port `5432` may already be occupied by a
local PostgreSQL installation:

```bash
docker start dev-postgres 2>/dev/null || docker run -d --name dev-postgres \
	-e POSTGRES_USER=compliance \
	-e POSTGRES_PASSWORD=compliance \
	-e POSTGRES_DB=compliance_review \
	-p 5433:5432 \
	pgvector/pgvector:pg16

export DATABASE_URL=postgresql+asyncpg://compliance:compliance@localhost:5433/compliance_review
export REDIS_URL=redis://localhost:6379/0
PYTHONPATH=backend .venv/bin/uvicorn app.main:app --reload --app-dir backend
```

Run the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```

### Stop, inspect, and reset the environment

```bash
# Stop containers and keep database data
docker compose down

# View service status
docker compose ps

# Follow logs for one service
docker compose logs -f backend

# Stop containers and delete the Compose database volume
docker compose down -v
```

Use `docker compose down -v` only when you intentionally want a fresh database; it
deletes local Postgres data.

### Troubleshooting

**Port 5432 is already in use**

Compose defaults to host port `5433`, so it should not conflict with a local
PostgreSQL service. To choose another host port, set it when starting Compose:

```bash
POSTGRES_PORT=5434 docker compose up --build
```

**Port 8000 or 3000 is already in use**

Stop the process using the port, or temporarily edit the host-side port mapping in
`docker-compose.yml`. The port on the right side of each mapping is the container
port and should remain unchanged.

**A container will not start after configuration changes**

Rebuild the affected image:

```bash
docker compose up --build backend worker frontend
```

**Database migration fails**

Check that Postgres is healthy and inspect its logs:

```bash
docker compose ps
docker compose logs postgres
```

For a clean local database, run `docker compose down -v` and start Compose again.

### Implementation Status

The application provides an end-to-end compliance review platform:
- **Backend & Worker**: FastAPI REST API, Celery + Redis async worker pipeline, Presidio PII masking, local vector embeddings (`bge-small-en-v1.5`), `pgvector` retrieval engine, Server-Sent Events (SSE) notification streaming, and automated Alembic database migrations.
- **Frontend**: Next.js 16 App Router interface with Turbopack, Tailwind CSS v4, split-pane advisor/compliance officer workflows, real-time live synchronization via SSE, institutional toast alerts, and graceful degradation handling when AI services are degraded or unavailable.
