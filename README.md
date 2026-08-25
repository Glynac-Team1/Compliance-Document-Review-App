# Compliance-Document-Review-App
# Compliance Document Review App

A web application that replaces ad-hoc compliance review with a shared queue, an immutable audit trail, and an AI assist panel that flags issues (missing disclosures, inconsistent claims, missing signatures) without ever making the decision itself. The human compliance officer always makes the final call.

Built as a 4-week intern glynac project across five tracks: Backend, Frontend, AI, Data Engineering, DevOps/Platform.

See also: [`docs/technical-implementation-plan.md`](./technical-implementation-plan.md) for detailed per-track scope, and [`docs/architecture.md`](./architecture.md) for system and data/AI diagrams.

---

## Engineering Team & Core Track Ownership

| Team Member | Track | Specialization & Key Responsibilities |
|---|---|---|
| **Basamsetti Venkata Vamsi** | **AI Engineering** | PII masking pipelines (Presidio + custom regex), prompt engineering, structured JSON schema enforcement, and third-party LLM integrations (Gemini / Groq). |
| **Kashish Agarwal** | **Backend Engineering** | FastAPI REST endpoints, session/role auth enforcement (server-side 403 gates), document lifecycle state machine, and Celery/Redis background task orchestration. |
| **Daniel Ojo** | **Frontend Engineering** | Next.js + TypeScript SPA, split-pane review interface, TanStack Query integration, role-gated routes, and responsive UI/UX for loading & degraded states. |
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
| Frontend | React + TypeScript, Vite, TanStack Query, Tailwind CSS |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Celery + Redis |
| Database | PostgreSQL 16 + `pgvector` (HNSW index) |
| AI | Gemini API (Google AI Studio free tier) or Groq — no production Anthropic credits |
| PII Masking | Microsoft Presidio + custom regex recognizers |
| Embeddings | Local `sentence-transformers` (`BAAI/bge-small-en-v1.5`) — never sent to a third party |
| Infra | Docker Compose, GitHub Actions CI |

Full rationale for each choice is in [`technical-implementation-plan.md §4`](./technical-implementation-plan.md#4-tech-stack-by-track).

---

## Getting Started

### Prerequisites
- Docker and Docker Compose
- A free-tier LLM API key: [Google AI Studio](https://aistudio.google.com/) (recommended) or Groq/OpenRouter

### 1. Clone and configure

```bash
git clone <repo-url>
cd compliance-review-app
cp .env.example .env
# edit .env: set LLM_API_KEY, LLM_PROVIDER=gemini|groq, SESSION_SECRET
