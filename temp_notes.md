# AI Context: Compliance Document Review App

This document is generated from repository inspection on 2026-09-20. The implementation is authoritative. Where repository documentation describes behavior that the code does not currently implement, this document calls out the conflict.

## 1. Repository Map

Important directories and files:

| Path | Responsibility |
|---|---|
| `backend/app/main.py` | FastAPI application creation, CORS, startup/shutdown of the event manager, router registration, health endpoint, global exception handler. |
| `backend/app/api/` | REST route groups for authentication, documents/reviews, roles, invitations, and notifications. |
| `backend/app/core/security.py` | Password hashing/verification, JWT creation/decoding, role dependencies, secure token generation. |
| `backend/app/core/storage.py` | Boto3 client and MinIO upload helper. |
| `backend/app/core/events.py` | Redis Pub/Sub-backed in-process SSE connection manager. |
| `backend/app/core/sse_tickets.py` | In-memory short-lived, single-use SSE ticket store. |
| `backend/app/config.py` | Pydantic settings loaded from `.env` and `../.env`. |
| `backend/app/database.py` | Async SQLAlchemy engine/session caching by event loop. |
| `backend/models/__init__.py` | SQLAlchemy models and enums. |
| `backend/alembic/versions/` | Alembic schema history, constraints, indexes, and merges. |
| `worker/celery_app.py` | Celery application and `analyze_document` task. |
| `worker/ai/` | PII masking, LLM integration, response schemas, and seeded compliance rules. |
| `worker/data_eng/` | Extraction, chunking, embeddings, pgvector retrieval, disclosure detection, precedents, seed scripts, and tests. |
| `frontend/app/` | Next.js App Router pages for login, onboarding, advisor, officer, and admin workflows. |
| `frontend/components/` | Shared navigation, notifications, toast, and UI components. |
| `frontend/lib/api.ts` | Browser API base URL resolution and API error formatting. |
| `frontend/lib/useLiveSync.ts` | Notification fetch, read operations, and SSE client. |
| `frontend/__tests__/` | Frontend Vitest/Testing Library tests. |
| `fixtures/sample_docs/` | Four sample text documents used by privacy tests. |
| `scripts/` | Evaluation and outbound-payload inspection utilities. |
| `docs/architecture.md` | Architecture diagrams and design narrative; contains conflicts noted below. |
| `docs/technical-implementation-plan.md` | Planning document; not authoritative when it conflicts with code. |
| `docker-compose.yml` | Local Postgres, Redis, MinIO, backend, worker, and frontend services. |
| `.github/workflows/ci.yml` | GitHub Actions validation workflow. |

There is no verified production deployment workflow or cloud deployment configuration. `UNKNOWN — verify in repository` for any production hosting target, deployment topology, or branch-protection setting beyond the CI workflow and documentation.

## 2. Project Overview

The application is a multi-tenant document review system for financial compliance workflows. Advisors upload PDF, DOCX, or XLSX documents. Compliance officers see a workspace-scoped queue, claim a document for review, inspect AI-assisted findings, and record approve/reject/needs-revision decisions. AI output is assistance only; the officer decision is stored separately in the review workflow.

Primary actors:

- **Workspace administrator:** an officer with `is_admin=True`; creates a workspace and manages invitations/team membership.
- **Advisor:** submits documents and views owned document status/notifications.
- **Compliance officer:** reviews workspace documents, claims/release/heartbeats locks, views analysis, and records decisions.
- **Worker:** asynchronously extracts, masks, embeds, retrieves context, calls an LLM, and persists analysis results.

The implemented high-level flow is:

1. An organization is created through `POST /auth/workspaces`, producing one officer administrator.
2. The administrator invites advisors/officers through `/admin/invitations`.
3. An invited user accepts the invitation or signs up with a matching invitation.
4. An advisor uploads a supported file through `POST /documents`.
5. The API stores the object in MinIO, writes document/audit/analysis/notification records, and sends a Celery task to Redis.
6. The worker processes the document and stores status, summary, normalized flags, and legacy JSON analysis data.
7. An officer claims the document, reviews the result and source document, and records a decision.
8. The advisor receives a database notification and real-time event.

## 3. Technology Stack

### Backend

- Python 3.12 Docker runtime.
- FastAPI `0.115.0` with Uvicorn `0.32.0`.
- SQLAlchemy `2.0.36`, async sessions, and `asyncpg 0.29.0`.
- Alembic `1.13.3` migrations.
- Pydantic Settings `2.5.2`; route request models use Pydantic.
- PostgreSQL 16 with `pgvector`; Compose uses `pgvector/pgvector:pg16`.
- JWT bearer authentication using `python-jose`, HS256, seven-day expiration by default.
- Password hashes use bcrypt directly through the `bcrypt` package; `passlib` is listed but the inspected security module uses `bcrypt`.
- REST API is organized by FastAPI routers, with dependency-based role checks.

### Worker and data engineering

- Celery `5.4.0` with Redis transport/backend.
- Redis `7-alpine` in Compose.
- `pdfplumber 0.11.4` for PDF extraction, stdlib ZIP/XML parsing for DOCX, `openpyxl 3.1.5` for XLSX, and a text reader for `.txt`/`.md` worker inputs.
- Sentence Transformers `3.1.1` with CPU PyTorch `2.5.1+cpu`.
- Local embedding model `BAAI/bge-base-en-v1.5`, normalized 768-dimensional vectors.
- PostgreSQL/pgvector stores rule and precedent embeddings; HNSW cosine indexes are created by migration `7b2c4d6e8f10_add_vector_hnsw_indexes.py`.

### AI

- Supported LLM providers in `worker/ai/gemini_assist.py`: Google Gemini and Groq.
- Gemini model: `GEMINI_MODEL`, default `gemini-3.6-flash`; obsolete model fallbacks are not used.
- Groq model: `GROQ_MODEL` default `llama-3.3-70b-versatile`.
- HTTP calls use stdlib `urllib.request`, 20-second request timeout, and up to three attempts for 429/5xx/URL errors through Tenacity when installed, otherwise a local retry loop.
- LLM output is parsed as JSON and validated with Pydantic `AIAnalysisResult`/`ComplianceFlag`.
- The worker filters returned flags to IDs in retrieved rule or missing-disclosure context, but persistence has an unsafe fallback described in Known Issues.

### Frontend

- Next.js `16.3.0`, React 19, TypeScript `5.7.3`, App Router.
- npm is used in CI (`frontend/package-lock.json`); package scripts include Next dev/start/build, ESLint, Vitest, and TypeScript checking.
- Tailwind CSS 4, Lucide React, Testing Library, JSDOM, and Vitest `4.1.11`.
- Browser API calls use `fetch` with a bearer token stored in `localStorage` under `auth_token`.
- Real-time updates use native `EventSource` against `/notifications/stream`; see the SSE discrepancy in section 8.

### Infrastructure

- Dockerfiles use Python 3.12 slim multi-stage builds for backend/worker.
- Docker Compose services: `postgres`, `redis`, `minio`, `backend`, `worker`, `frontend`.
- MinIO is used through the S3-compatible Boto3 API.
- GitHub Actions CI has Python, frontend, and Docker validation jobs.
- No CD/deployment workflow is present.

## 4. Architecture and Communication

### Frontend

The browser talks to the FastAPI backend only. It sends bearer JWTs for REST calls, uploads files as multipart form data, and reads notification events through SSE. The frontend does not call Celery, Redis, PostgreSQL, MinIO S3 APIs, or LLM APIs directly.

### Backend process

`backend/app/main.py` registers routers under `/auth`, `/documents/mine`, `/documents`, `/queue`, and `/notifications`. The backend validates requests, checks JWT roles, accesses PostgreSQL through async SQLAlchemy, uploads/creates MinIO objects, broadcasts Redis-backed events, and dispatches the Celery task.

### Celery worker

`worker/celery_app.py` creates a Celery app using `settings.redis_url` for both broker and result backend. `analyze_document(document_id)` runs an async inner function via `asyncio.run`, creates its own async engine/session, reads PostgreSQL, downloads from MinIO, invokes the local data/AI pipeline, and commits results. The default queue is `document-analysis`.

### PostgreSQL

PostgreSQL is the application and metadata system of record. It stores users, workspaces, invitations, document metadata/status, reviews, normalized AI analysis/flags, rules, precedents, PII mappings, audit events, and notifications. pgvector columns are stored in `rules.embedding` and `precedents.embedding`.

### Redis

Redis is the Celery broker/result backend and the Redis Pub/Sub channel backend for cross-process SSE event delivery. The channel name in `backend/app/core/events.py` is `sse_events`.

### MinIO/S3

MinIO stores uploaded binary document objects. PostgreSQL stores only the generated object key in `Document.file_reference` plus metadata such as filename and type.

### External LLM services

The worker sends a prompt containing masked document text and retrieved context to Gemini or Groq. Local embedding generation and database retrieval occur before that outbound call. The inspected code does not send raw document text to the LLM intentionally; it passes `masked_text` to `GeminiAssistEngine.analyze_masked_document`.

## 5. End-to-End Data Flows

### Upload and analysis

The verified path is:

`backend/app/api/documents.py -> upload_document()`
`-> app.core.storage.upload_file_to_minio()`
`-> Document + AuditEvent(submitted) + AIAnalysis(pending) + Notification rows`
`-> celery_client.send_task("worker.celery_app.analyze_document", queue="document-analysis")`
`-> worker/celery_app.py -> analyze_document()`

Worker stages:

1. Fetch `Document` and existing `AIAnalysis` by document UUID.
2. Download `doc.file_reference` from MinIO to a temp-directory path.
3. Extract text with `TextExtractor.extract()` in `worker/data_eng/extractors.py`.
4. Mask text with `PIIMasker.mask()`; delete and rewrite document PII mappings in `pii_mappings`.
5. Chunk masked text with `chunk_document()` using 800-character chunks and 150-character overlap.
6. Embed chunks once with `embed_document_chunks()` using normalized local 768-dimensional vectors.
7. Retrieve up to three rules per chunk, merged and capped at eight total by `retrieve_rules_for_document()`.
8. Detect missing required disclosures using `find_missing_disclosures()` and threshold `0.35` cosine distance.
9. Retrieve three precedents using an average of chunk embeddings and `retrieve_precedents()`.
10. Mask precedent comments again before adding them to LLM context.
11. Call `GeminiAssistEngine.analyze_masked_document(masked_text, pii_mapping, rules_context, missing_disclosures, precedents)`.
12. The engine constructs provider-specific prompts, calls Gemini/Groq, extracts JSON, validates it with Pydantic, and unmasks validated summary/flags for internal persistence.
13. Store precedents in legacy `Document.ai_analysis`, filter flags against retrieved context IDs, resolve rule foreign keys, and insert `Flag` rows.
14. Set `AIAnalysis.summary`, `model_name`, `error_message`, `status`, and `generated_at`; commit.
15. Remove the temporary downloaded file in `finally`.

Retrieval exceptions are caught inside the worker retrieval block, logged with `print`, and replaced with empty contexts. The worker then continues to the LLM call. This is current behavior, not a guarantee that retrieval is required for successful analysis.

### Officer review and decision

Relevant path:

`backend/app/api/documents.py -> claim_document()`
`-> document lock fields/status + claimed AuditEvent + advisor Notification`
`-> execute_officer_decision()`
`-> Review row update/insert + decided AuditEvent + advisor Notification`

`backend/app/api/roles.py -> submit_review()` calls the same `execute_officer_decision()` helper through `/queue/{document_id}/review`. The separate `/documents/{document_id}/decision` route also calls it.

`GET /documents/{document_id}/analysis` returns 202 while analysis is pending, a degraded/manual-review response when analysis status is error, and normalized `Flag` rows plus legacy stored precedents when ready.

### Revisions

An advisor may submit `previous_version_id` only when the previous document exists, belongs to that advisor, and has `DocumentStatus.needs_revision`. The new document points to the previous version and shares a `thread_root_id`; `GET /documents/{document_id}/thread` returns the ordered version chain.

## 6. Database Architecture

Models are defined in `backend/models/__init__.py`. UUIDs are used for primary keys unless noted.

### Tables and key constraints

- `workspaces`: `id` primary key, required `name`, unique required `slug`, `created_at`.
- `workspace_invitations`: workspace FK, email, `Role`, unique token, `InvitationStatus`, expiry, creation timestamp.
- `users`: role, name, unique email, password hash, nullable workspace FK, `is_admin`, timestamp. PostgreSQL partial unique index `uq_workspace_single_admin` allows at most one admin per workspace. Check constraint `chk_admin_must_be_officer` requires admins to have role `officer`.
- `documents`: advisor FK, filename, `DocumentStatus`, nullable officer lock FK and `locked_at`, required storage reference/type, nullable self-FKs `previous_version_id` and `thread_root_id`, timestamp, nullable `workspace_id`, nullable JSONB `ai_analysis`.
- `reviews`: document FK with unique constraint, officer FK, `Decision`, required comment, decision timestamp. The code updates the one review row for repeated decisions rather than appending multiple review rows.
- `rules`: unique `rule_key`, type, text, nullable vector column declared `Vector(768)`, source, corpus version, embedding model, timestamps.
- `ai_analyses`: unique document FK, nullable summary/model/error, `AnalysisStatus`, generated timestamp.
- `flags`: analysis FK, passage excerpt, required rule FK, explanation, `Severity`.
- `audit_events`: actor FK, document FK, `AuditAction`, timestamp. The table has no update/delete protection in the inspected model/migrations.
- `pii_mappings`: composite primary key `(document_id, placeholder)`, original value.
- `precedents`: nullable unique seed key, nullable source document FK, masked text, `Decision`, comment, nullable vector declaration `Vector(768)`, source/model/timestamp.
- `notifications`: user FK, nullable workspace FK, required document FK, message, read flag, timestamp.

### Enums

- `Role`: `advisor`, `officer`.
- `InvitationStatus`: `pending`, `accepted`, `revoked`.
- `DocumentStatus`: `pending`, `in_review`, `approved`, `rejected`, `needs_revision`.
- `Decision`: `approve`, `reject`, `needs_revision`.
- `AnalysisStatus`: `pending`, `ready`, `error`.
- `Severity`: `low`, `medium`, `high`.
- `AuditAction`: `submitted`, `viewed`, `claimed`, `decided`, `resubmitted`.

### Database invariants and relationships

- `AIAnalysis.document_id` is unique, so one analysis row exists per document.
- `Review.document_id` is unique, so the current implementation stores one mutable review row per document.
- Flags reference normalized `Rule` rows through `matched_rule_id`; the document's legacy JSONB analysis stores summary/flags/precedents separately.
- PII mappings are deleted and recreated for a document on each worker attempt.
- Workspace IDs are nullable for legacy/unscoped records. Route code applies workspace checks conditionally when a document/user has a workspace.
- The inspected migrations define vector HNSW indexes using `vector_cosine_ops` for rules and precedents.
- No ORM relationships or cascade rules are declared in `models/__init__.py`; foreign-key delete behavior should be treated as `UNKNOWN — verify in migrations/database` before changing deletion semantics.

## 7. API Architecture

All protected routes use bearer JWT dependencies. Exact route implementations are in the listed files.

### Authentication and workspaces (`backend/app/api/auth.py`)

- `POST /auth/lookup-workspaces`: public email lookup for an existing user or pending invitation.
- `POST /auth/signup`: requires a matching pending invitation for the requested role; accepts the invitation and returns a JWT.
- `POST /auth/login`: verifies email/password and returns a JWT plus user/workspace metadata.
- `GET /auth/me`: bearer-authenticated current-user lookup.
- `POST /auth/workspaces`: public workspace creation; creates or converts an initial officer administrator.

### Invitations and administration (`backend/app/api/invitations.py`)

- `POST /admin/invitations`: administrator only; creates or refreshes a seven-day invitation and attempts Brevo email delivery.
- `GET /invitations/verify/{token}`: public invitation validation.
- `POST /invitations/accept`: public token acceptance; creates/updates the user, sets `is_admin=False`, and returns a JWT.
- `GET /admin/invitations`: administrator-only workspace invitation listing.
- `DELETE /admin/invitations/{invitation_id}`: administrator-only revoke; already revoked invitations are purged.
- `POST /admin/invitations/{invitation_id}/resend`: administrator-only renewal and email dispatch.
- `GET /admin/team`: administrator-only team listing.
- `DELETE /admin/team/{user_id}`: administrator-only workspace removal by setting the member's `workspace_id` to `NULL`; self-removal is rejected.

### Documents and officer actions (`backend/app/api/documents.py`)

- `POST /documents`: advisor only multipart upload; enforces configured size and MIME checks, stores object, creates metadata/analysis/audit/notifications, dispatches Celery.
- `POST /documents/{document_id}/claim`: officer only; claims or takes over an expired lock.
- `POST /documents/{document_id}/release`: officer only; only current lock owner may release.
- `POST /documents/{document_id}/heartbeat`: officer only; refreshes current owner's lock timestamp.
- `GET /documents/{document_id}/analysis`: officer only; returns 202 pending, degraded error response, or ready analysis.
- `POST /documents/{document_id}/decision`: officer only; records decision through `execute_officer_decision()`.
- `GET /documents/{document_id}/thread`: advisor or officer; advisor ownership and officer workspace checks apply.
- `GET /documents/{document_id}`: advisor or officer; writes a viewed audit event and returns document metadata/legacy AI JSON.
- `GET /documents/{document_id}/audit` and `/audit-log`: advisor or officer; returns ordered audit events after ownership/workspace checks.

### Role dashboards (`backend/app/api/roles.py`)

- `GET /documents/mine`: advisor only; lists owned documents.
- `GET /documents/mine/notifications`: advisor only wrapper around notification listing.
- `POST /documents/mine/notifications/{notification_id}/read`: advisor only wrapper.
- `GET /queue`: officer only; workspace-scoped review queue.
- `POST /queue/{document_id}/review`: officer only; decision helper route.
- `GET /queue/{document_id}/view`: officer only; returns a one-hour presigned object URL rewritten from the internal MinIO endpoint to `PUBLIC_STORAGE_URL`.

### Notifications and SSE (`backend/app/api/notifications.py`)

- `GET /notifications`: advisor/officer; returns up to 50 user notifications and unread count, optionally workspace-filtered.
- `POST /notifications/{notification_id}/read`: marks a notification read for its owner.
- `POST /notifications/read-all`: marks the current user's notifications read, optionally workspace-filtered.
- `POST /notifications/stream/ticket`: authenticated advisor/officer endpoint issuing an in-memory ticket.
- `GET /notifications/stream?ticket=...`: redeems the ticket and streams events.

The frontend currently constructs `/notifications/stream?token=<JWT>` in `useLiveSync.ts`, while the backend route accepts `ticket` and does not decode a JWT in `stream_events()`. This is an implementation/documentation/client mismatch and may prevent the checked-in frontend SSE flow from authenticating correctly.

## 8. Authentication, Authorization, and Security

### Implemented protections

- JWTs are signed with HS256 using `SESSION_SECRET`, carry subject, role, workspace ID, admin flag, issued-at, and expiration, and default to seven days.
- API role dependencies reject wrong roles with 403 before endpoint logic.
- Passwords are bcrypt-hashed and password validation requires eight characters, upper/lowercase, digit, special character, and rejects several common bases.
- Open signup without a matching pending invitation is rejected for both roles.
- Invitation tokens use `secrets.token_urlsafe`, are stored uniquely, expire after seven days, and are marked accepted on successful signup/acceptance.
- PostgreSQL prevents more than one administrator per workspace and prevents advisor administrators.
- Advisor document access checks ownership. Officer document access generally checks workspace membership when the document has a workspace.
- SSE uses a short-lived, single-use in-memory ticket design in the backend ticket module, but the frontend currently sends the wrong query parameter as noted above.
- LLM input is masked before provider calls in the worker pipeline; mapping values remain in PostgreSQL.
- Global exception handling returns a generic 500 response with a correlation ID while logging the exception through the application logger.

### Known security limitations

- `SESSION_SECRET` has a development default and `OFFICER_SIGNUP_CODE` exists in configuration/Compose but was not observed being enforced by the inspected signup route. `UNKNOWN — verify whether another route or historical flow uses it.`
- SSE tickets are process-local. Redis synchronizes events, but ticket issuance/redemption is not shared across backend replicas.
- The checked-in frontend passes a JWT in the SSE query string instead of obtaining/using the backend ticket parameter. Do not describe SSE authentication as working end-to-end without verifying it.
- MinIO defaults to `minioadmin` credentials in settings/Compose unless overridden in the environment. The inspected storage helper creates the bucket on upload and does not configure public ACLs; browser access uses presigned URLs.
- Logs use `print` for extraction/retrieval/worker failures. The code does not provide a repository-wide guarantee that raw PII cannot enter every log path; do not claim such a guarantee without auditing all logging.
- Several officer routes query a document before workspace authorization. They return 403 before returning data for mismatched workspaces, but route-by-route authorization should be preserved when editing.

## 9. Document Storage

`backend/app/core/storage.py` creates a Boto3 S3 client using `MINIO_ENDPOINT`, access key, secret key, path-style addressing, and region `us-east-1`.

`upload_file_to_minio()` generates a UUID filename preserving the source extension, calls `head_bucket`, creates the bucket if that call fails, and writes the bytes with the supplied content type. `upload_document()` performs the upload in a worker thread after reading the entire request into memory and validating a maximum of `MAX_UPLOAD_MB` and the MIME detected by `python-magic` from the first 2048 bytes.

The worker downloads by bucket/key to the system temp directory. The temporary file is removed in the task `finally` block. No cleanup of the MinIO object on database failure or document deletion was found: `UNKNOWN — verify desired object lifecycle before adding cleanup.`

The officer view route creates a one-hour presigned GET URL and rewrites the configured internal endpoint to `PUBLIC_STORAGE_URL`. The object is not documented as publicly readable.

## 10. Celery and Async Behavior

- Celery app: `worker.celery_app.celery_app`.
- Task: `worker.celery_app.analyze_document(document_id: str) -> dict`.
- Broker and result backend: `settings.redis_url`.
- Default task queue: `document-analysis`; the API explicitly sends the same queue.
- The task is a synchronous Celery function that calls `asyncio.run()` around async SQLAlchemy work.
- The task creates and disposes a new async engine per invocation.
- No explicit Celery retry decorator, task retry policy, task time limit, acknowledgement configuration, or task routing beyond the default queue was found. `UNKNOWN — verify deployment worker command/options before assuming any operational policy.`
- API dispatch is not wrapped in a failure handler. A `send_task()` failure occurs after the upload database commit and is not converted into a document/analysis error by `upload_document()`.
- Worker extraction failures set analysis/document JSON error data and return an error result. Other processing exceptions do the same.
- LLM provider retries are internal HTTP retries; they are not Celery task retries.

## 11. RAG and Data Engineering

### Rules

Rules are stored in `rules` with stable unique `rule_key`, type, text, 768-dimensional vector, source, corpus version, and embedding model. `seed_rules_corpus.py` embeds `worker.ai.rules_corpus.COMPLIANCE_RULES_CORPUS` and upserts by `rule_key`; it uses source `synthetic-seed` and corpus version `v1`.

`retrieve_rules_for_document()` queries `Rule.embedding.cosine_distance(embedding)`, orders ascending, takes three rules per document chunk, merges duplicate keys by best distance, sorts, and caps the prompt context at eight rules. It has no similarity threshold for ordinary rule retrieval.

### Missing disclosures

`find_missing_disclosures()` filters rules by `rule_type == "REQUIRED_DISCLOSURE"`. For each disclosure it computes the minimum cosine distance against all document chunk embeddings; distance greater than `0.35` is classified as missing. The threshold is documented in code as an evaluation starting value, not statistically validated production calibration.

### Precedents

Precedents store masked text, decision, comment, optional source document, optional stable seed key, and a whole-document 768-dimensional embedding. The seed script inserts 12 explicitly synthetic/demo precedents. `retrieve_precedents()` averages all document chunk embeddings, queries cosine distance, and returns the top three. `add_precedent()` embeds at most the first 2,000 characters of masked text. The inspected code documents production precedent insertion as a future integration point; no officer-decision-to-precedent wiring was found.

### Chunking

`chunk_document()` uses a heuristic sentence split after `.`, `!`, or `?` followed by whitespace and a capital letter/digit. It greedily packs up to 800 characters, carries up to 150 characters of tail sentence overlap, and hard-splits an oversized sentence using a 650-character step. Chunks contain original-text character offsets and are not persisted.

### Embeddings

`worker/data_eng/embeddings.py` caches one `SentenceTransformer` instance per process with `lru_cache(maxsize=1)`. `embed_text()` and `embed_texts()` call `encode(..., normalize_embeddings=True)`. The actual model is `BAAI/bge-base-en-v1.5`, dimension 768. The models declare `Vector(768)`. Retrieval uses cosine distance through pgvector; missing-disclosure local comparison uses `1 - dot product` because inputs are normalized.

### Grounding behavior

The worker first builds `allowed_rule_ids` from retrieved ordinary rules and missing disclosures, then filters the in-memory analysis flags to those IDs. However, it subsequently resolves each remaining rule key from the database and, if unresolved, selects any existing `Rule.id`; if no rule exists, it creates a fabricated `auto-fallback` rule with a zero vector. Therefore strict grounding is not currently guaranteed at persistence time. Unknown rule IDs must not be mapped to arbitrary rules or fabricated rules in future changes.

## 12. PII Handling

`PIIMasker` uses one custom combined regex. It detects emails, titled client names, SSNs, `ACC-` account identifiers, phone patterns, bare 9-12 digit account-like values, and currency amounts. It produces stable per-run placeholders such as `[EMAIL_1]`, `[CLIENT_1]`, `[PHONE_1]`, `[ACCOUNT_1]`, and `[AMOUNT_1]`; repeated identical entities reuse their placeholder. It returns `(masked_text, mapping)` where the mapping is placeholder to original value.

The worker extracts raw text, masks it, stores mapping values in `pii_mappings`, and uses masked text for chunking, embeddings, retrieval, and LLM input. `GeminiAssistEngine` validates the LLM response before unmasking summary/flags for internal persistence. Precedent comments are separately masked before being added to LLM context.

The raw original document remains in MinIO and the mapping remains in PostgreSQL. The API returns unmasked stored flag passages/ explanations to authorized officers. The repository tests verify representative payloads contain placeholders rather than fixture PII, but regex coverage is not equivalent to a universal PII guarantee.

## 13. LLM Integration

`GeminiAssistEngine._build_payload()` supplies:

- compliance rules context,
- optional missing-disclosure records,
- optional similar past decisions,
- PII-sanitized submitted document text,
- a system instruction requiring JSON with `summary` and `flags`.

Gemini uses `contents`, `systemInstruction`, and JSON response MIME configuration. Groq uses OpenAI-compatible `messages`, JSON response format, and low temperature. The engine tries the configured provider and a configured secondary provider if a key exists. It falls back to a degraded response when no key exists or all provider attempts fail.

`_validate_response()` cleans code fences/wrapping, parses JSON, validates each flag with Pydantic, normalizes severity case, and returns an `AIAnalysisResult`. The worker persists provider/model metadata. No provider SDK is used; requests are made with `urllib.request`.

## 14. Pipeline States and Failure Behavior

### Analysis

`AnalysisStatus` is `pending`, `ready`, or `error`. Upload creates `pending`. Successful non-degraded worker output sets `ready`. Extraction or general worker exceptions set `error`. Missing LLM credentials/provider failure returns a degraded result, which the worker persists as `error` with the summary in `error_message`; the task itself returns a completed-style result only for the outer successful path.

`GET /documents/{id}/analysis` returns 202 for pending, a manual-review response for error, or flags/precedents for ready. There is no inspected automatic retry transition from error to pending.

### Document

`DocumentStatus` is `pending`, `in_review`, `approved`, `rejected`, or `needs_revision`. Upload creates pending. Claim changes to in_review. Release changes in_review back to pending. Decisions map to approved/rejected/needs_revision and clear the lock. Advisors may resubmit only from needs_revision.

The AI worker does not update `Document.status` to an analyzing/ready/error state; AI state is tracked by `AIAnalysis.status` and legacy `Document.ai_analysis` JSON. Claims and decisions are separate from AI completion.

### Failures and partial persistence

- Extraction errors commit an error analysis and legacy JSON response.
- Other worker exceptions commit a generic unavailable error response.
- Retrieval errors are swallowed inside the retrieval block and analysis continues with empty retrieval contexts.
- LLM failure degrades through `GeminiAssistEngine` rather than raising to Celery.
- Database failures during the worker/API transaction are not given a special recovery path in the inspected code. `UNKNOWN — verify database failure/retry behavior in deployment.`
- Celery dispatch failure after upload commit is not recorded as a pipeline state.

## 15. Data Engineering Invariants

Future changes should preserve these verified boundaries:

1. Use 768-dimensional vectors with the configured embedding model unless a coordinated migration changes model, stored vectors, indexes, and retrieval.
2. Preserve normalized embeddings and cosine-distance semantics.
3. Keep document chunks ephemeral unless a schema/migration explicitly introduces persisted chunks.
4. Keep raw text, masked text, and PII mapping distinct.
5. Never send raw document text or mapping values to an external LLM unless an explicitly reviewed requirement changes that boundary.
6. A persisted flag should reference the exact retrieved rule that supports it. The current arbitrary/fallback rule mapping is a known defect, not an invariant to preserve.
7. Retrieval failure currently degrades to empty context and continues; changing that requires explicit status/error semantics and tests.
8. Preserve unique analysis/document and review/document constraints unless database semantics intentionally change.
9. Preserve workspace ownership checks and officer lock ownership checks on every new document action.
10. Treat synthetic seeded precedents as demo data, not real reviewed documents.

## 16. Concurrency and Transaction Boundaries

The claim implementation reads a document, checks the current lock in Python, sets `status`, `locked_by_officer_id`, and `locked_at`, then commits. No `SELECT ... FOR UPDATE`, atomic conditional update, version column, or database advisory lock was found. The test suite verifies sequential claim behavior, expiry takeover, heartbeat ownership, and review rejection for another officer; it does not prove simultaneous race safety. The claim operation is therefore not verified as atomic and is vulnerable to a concurrent read-then-write race.

Review decision similarly reads and validates the current lock before mutating the document and review. It commits one transaction and broadcasts after commit. Worker PII replacement, flags deletion/insertion, and analysis updates happen in the worker session transaction, with an early commit when creating a missing AIAnalysis row and a final commit for analysis output.

Database engine uniqueness constraints protect workspace admin count, user email, invitation token, analysis per document, review per document, and rule/seed precedent keys. They do not by themselves protect the document claim race.

## 17. Environment Variables and Configuration

No actual secret values are reproduced here.

| Variable | Used by | Purpose | Required? | Example/default | Sensitive? |
|---|---|---|---|---|---|
| `DATABASE_URL` | backend, worker, Alembic/CI | Async PostgreSQL connection | Yes for DB work | Compose service URL; settings fallback references `db` | Yes |
| `REDIS_URL` | backend, worker, Celery, SSE events | Redis broker/Pub/Sub | Yes for async/events | `redis://redis:6379/0` | No |
| `MINIO_ENDPOINT` | backend storage | Internal S3 endpoint | No in settings, required for correct deployment | `http://minio:9000` | No |
| `MINIO_ACCESS_KEY` | backend storage | MinIO access credential | No in settings | placeholder local admin | Yes |
| `MINIO_SECRET_KEY` | backend storage | MinIO secret credential | No in settings | placeholder local admin | Yes |
| `MINIO_BUCKET_NAME` | backend/worker | Object bucket | No | `compliance-documents` | No |
| `PUBLIC_STORAGE_URL` | backend | Browser-reachable presigned URL endpoint rewrite | No | `http://localhost:9000` | No |
| `SESSION_SECRET` | backend/worker security settings | JWT signing secret | Compose requires it; settings has development fallback | placeholder | Yes |
| `ENVIRONMENT` | settings/Compose/CI | Environment name and default-secret validation | No | `development` | No |
| `OFFICER_SIGNUP_CODE` | settings/Compose/CI | Configured officer signup code | Compose requires it; use is not verified in the inspected route | placeholder | Yes |
| `LLM_API_KEY` | worker/backend Compose | Legacy Gemini/Groq key fallback | No; empty enables degraded analysis | empty placeholder | Yes |
| `LLM_PROVIDER` | worker/engine | `gemini` or `groq` selection | No | `gemini` | No |
| `GEMINI_API_KEY` | worker/Compose | Gemini provider key | empty | empty placeholder | Yes |
| `GEMINI_MODEL` | worker/Compose | Primary Gemini model | No | `gemini-3.6-flash` | No |
| `GROQ_API_KEY` | worker/Compose | Groq provider key | empty | empty placeholder | Yes |
| `GROQ_MODEL` | worker engine | Groq model | No | `llama-3.3-70b-versatile` | No |
| `MAX_UPLOAD_MB` | backend settings | Upload size limit | No | `10` | No |
| `ALLOWED_MIME_TYPES` | backend settings | MIME allow-list | No | PDF/DOCX/XLSX values in `.env.example` | No |
| `BREVO_API_KEY` | backend email service | Invitation email provider credential | No | empty placeholder | Yes |
| `BREVO_SENDER_EMAIL` | backend email service | Invitation sender | No | placeholder email | No |
| `BREVO_SENDER_NAME` | backend email service | Invitation sender name | No | `Northstar Compliance` | No |
| `FRONTEND_URL` | backend/Compose | Frontend URL used by application/email configuration | No | `http://localhost:3000` | No |
| `NEXT_PUBLIC_API_URL` | frontend | Optional browser API base override | No | derived from browser host port 8000 | No |

The environment table is based on `.env.example`, `backend/app/config.py`, Compose, CI, and inspected worker code. Any other variable is `UNKNOWN — verify in repository`.

## 18. Docker and Compose

Compose services:

- `postgres`: `pgvector/pgvector:pg16`, host port `${POSTGRES_PORT:-5433}` to container 5432, persistent `postgres_data`, init SQL mounted read-only, healthcheck with `pg_isready`.
- `redis`: `redis:7-alpine`, no host port mapping in Compose, persistent storage not configured, Redis healthcheck.
- `minio`: `minio/minio:latest`, host ports 9000/9001, persistent `minio_data`, MinIO healthcheck, console on 9001.
- `backend`: builds `./backend`, host port 8000, source mounted at `/app`, reload Uvicorn command, depends on healthy Postgres/Redis/MinIO.
- `worker`: builds root context with `worker/Dockerfile`, mounts worker/backend app/models/migrations and embedding cache, depends on healthy Postgres/Redis.
- `frontend`: builds `./frontend`, host port 3000, source and anonymous node_modules/.next mounts, runs `npm run dev`, depends on backend.

Container service names are `postgres`, `redis`, and `minio`; host applications use mapped host ports. CI does not start the full Compose stack: it uses GitHub service containers for PostgreSQL and Redis, runs migrations/seeding/tests directly, and separately validates/builds Compose images. MinIO is required for the full local application but is not a CI Python service.

Backend startup runs `backend/entrypoint.sh`; the exact migration/startup behavior should be checked there before changing startup assumptions. The worker entrypoint runs the Celery command from its Dockerfile.

## 19. CI/CD

`.github/workflows/ci.yml` triggers on pushes to `main` and pull requests targeting `main`, with cancellation of superseded runs. It has three jobs:

1. **Python:** Ubuntu 24.04, Python 3.12, PostgreSQL pgvector 16 and Redis services, pip installation of both requirements plus Ruff 0.11.2, Hugging Face cache, `libmagic1`, Ruff check, pgvector extension creation, Alembic upgrade, both corpus seed scripts, and `pytest backend/tests worker/ai worker/data_eng -v`.
2. **Frontend:** Node 20, `npm ci`, ESLint, `npx tsc --noEmit`, `npm test`, and `npm run build`.
3. **Docker:** Docker Buildx, `docker compose config --quiet`, and `docker compose build --pull backend worker frontend`.

The Ruff step has `continue-on-error: true`, so Ruff is non-blocking in the checked-in workflow. The workflow contains CI-only placeholder credentials and no provider API key. No deployment job exists. The docs recommend branch protection, but repository settings are not verifiable from files: `UNKNOWN — verify GitHub repository settings directly`.

## 20. Testing Architecture

Backend and worker tests use pytest/pytest-asyncio. `pyproject.toml` sets `pythonpath = ["backend"]`, `asyncio_mode = "auto"`, and function-scoped event loops. Backend tests use `httpx.AsyncClient` with `ASGITransport`, direct async sessions, generated UUID records, and explicit cleanup. They cover role boundaries, invitation/admin security, workspace admin constraints, claims/release/heartbeat/review behavior, notifications, sessions/slugs, and email service behavior.

Worker AI tests cover regex masking/unmasking, outbound payload privacy examples, degraded no-key behavior, JSON cleanup/schema validation, provider payload shapes, and flag mapping. Data-engineering tests cover extraction, chunking, embeddings, disclosure thresholds, retrieval, and precedent search.

The frontend has Vitest/Testing Library tests, including degraded-state behavior. CI does not run browser end-to-end tests, and no coverage configuration was found. Full production E2E coverage is `UNKNOWN — verify in repository`.

Tests verify sequential lock semantics but do not establish atomic concurrent claims. Tests verify representative regex PII cases, not complete entity recognition. The Celery test shown in `worker/ai/test_celery_analysis_flow.py` tests local mapping logic rather than executing the full Celery task against a real object and LLM provider.

## 21. Security Model Summary

Implemented protections include signed expiring bearer JWTs, bcrypt password hashing, role dependencies, invitation-gated role onboarding, workspace checks on major resource paths, database admin constraints, presigned object reads, local embedding generation, masked LLM input, Pydantic LLM response validation, and generic global 500 responses.

Known gaps include the non-atomic claim operation, process-local SSE tickets, frontend/backend SSE parameter mismatch, no verified use of `OFFICER_SIGNUP_CODE`, development MinIO credentials/defaults, incomplete proof that every log path excludes PII, no explicit Celery retry/timeout policy, and unsafe unknown-rule fallback. These are current implementation observations, not desired guarantees.

## 22. Design Decisions to Preserve

- PostgreSQL stores relational application state and pgvector retrieval data.
- MinIO/S3 stores raw uploaded objects; do not put document binaries in PostgreSQL without an explicit design change.
- Redis is shared by Celery and backend event Pub/Sub.
- Backend owns authorization and the worker owns asynchronous analysis.
- PII masking occurs before local retrieval and external LLM calls.
- Embeddings are local, normalized, 768-dimensional `bge-base-en-v1.5` vectors compared with cosine distance.
- Rules and precedents have separate retrieval semantics.
- Human officers make document decisions; AI analysis does not itself set approve/reject status.
- The normalized analysis/flag schema coexists with legacy `Document.ai_analysis` JSON and both are currently read by API code.

## 23. Current vs Desired Behavior / Known Issues

No Jira files or ticket identifiers were found in the inspected repository. Related Jira ticket for every item below: `UNKNOWN — verify in repository`.

### Unsafe unknown-rule fallback

- **Current implementation:** the worker filters flags by retrieved keys, then maps an unresolved key to any existing rule or creates an `auto-fallback` rule with a zero vector.
- **Desired behavior:** reject/drop unknown rule IDs or fail/degrade explicitly; never map them to arbitrary or fabricated rules.
- **Relevant files:** `worker/celery_app.py`, `backend/models/__init__.py`, `worker/ai/test_celery_analysis_flow.py`.
- **Relevant tests:** existing mapping tests do not cover unknown IDs.

### Non-atomic document claims

- **Current implementation:** claim reads then writes lock fields without row locking or conditional update.
- **Desired behavior:** a database-enforced/conditional claim where concurrent officers cannot both win.
- **Relevant files:** `backend/app/api/documents.py`, `backend/tests/test_claim_concurrency.py`.
- **Relevant tests:** sequential behavior and expiry are covered; a true simultaneous race is not.

### Retrieval failure is silently degraded

- **Current implementation:** exceptions from embedding/retrieval/disclosure/precedent work are printed and analysis continues with empty contexts.
- **Desired behavior:** `UNKNOWN — verify product requirement`; decide whether missing required retrieval should stop analysis, mark a distinct degraded state, or continue with a visible limitation.
- **Relevant files:** `worker/celery_app.py`, `worker/data_eng/retrieval.py`, `worker/data_eng/disclosure_check.py`, `worker/data_eng/precedent_search.py`.
- **Relevant tests:** retrieval unit tests do not establish full task failure policy.

### SSE ticket/client mismatch

- **Current implementation:** backend exposes authenticated ticket issuance at `/notifications/stream/ticket` and redemption using query parameter `ticket`; frontend `useLiveSync.ts` opens the stream with `token` and does not call the ticket endpoint.
- **Desired behavior:** one verified end-to-end short-lived ticket flow, or another explicitly reviewed authentication design.
- **Relevant files:** `backend/app/api/notifications.py`, `backend/app/core/sse_tickets.py`, `frontend/lib/useLiveSync.ts`.
- **Relevant tests:** notification tests cover REST lifecycle; no checked-in end-to-end SSE authentication test was found.

### Celery dispatch failure and task operations

- **Current implementation:** upload commits database state before `send_task`; dispatch exceptions are not persisted as a document/analysis failure. No explicit task retry, timeout, acknowledgement, or idempotency policy is configured in the inspected Celery code.
- **Desired behavior:** `UNKNOWN — verify operational requirements`; define observable dispatch failure and retry/idempotency semantics.
- **Relevant files:** `backend/app/api/documents.py`, `worker/celery_app.py`, `docker-compose.yml`, worker entrypoint.
- **Relevant tests:** no verified dispatch-failure integration test.

### Documentation drift

- **Current implementation:** custom regex PII masking, `bge-base-en-v1.5` 768-dimensional embeddings, non-atomic claim path, notification-only SSE route, mutable one-row review, and current fallback/degradation behavior.
- **Conflicting documentation:** `README.md`, `docs/architecture.md`, and planning text mention Presidio, `bge-small`, atomic claims, broader route/state names, and stronger append-only/degradation guarantees.
- **Desired behavior:** either update implementation or documentation through an intentional change; do not silently make `AI_CONTEXT.md` match aspirational documentation.
- **Relevant tests:** existing tests reflect portions of current implementation but do not resolve the conflicts.

### Storage and object lifecycle

- **Current implementation:** bucket creation is attempted lazily during upload; objects are keyed by UUID; no object cleanup path was found for failed transactions, deleted users, or document deletion.
- **Desired behavior:** `UNKNOWN — verify retention/deletion requirements`.
- **Relevant files:** `backend/app/core/storage.py`, `backend/app/api/documents.py`, `docker-compose.yml`.

### PII and observability coverage

- **Current implementation:** representative payload privacy tests pass through the regex masker, while worker errors use `print` and global logging covers unhandled API exceptions.
- **Desired behavior:** define and test a complete logging/redaction policy, including failures and provider/network errors.
- **Relevant files:** `worker/ai/pii_masker.py`, `worker/celery_app.py`, `backend/app/main.py`, worker/AI tests.

## 24. Verified Technical Debt

- Duplicate analysis representations: normalized `AIAnalysis`/`Flag` rows coexist with `Document.ai_analysis` JSON, and the API reads both.
- Review history is not append-only at the `Review` table level because `document_id` is unique and existing reviews are updated.
- Claim concurrency is not database-atomic.
- SSE ticket state is process-local while event delivery uses Redis.
- Frontend SSE uses a query parameter inconsistent with the backend ticket route.
- Retrieval failures are printed and bypassed rather than represented distinctly.
- No explicit Celery retry/time-limit policy is configured in inspected code.
- Synthetic precedent corpus contains 12 demo rows and is explicitly not a production corpus.
- Chunk sentence splitting is heuristic and can mis-split abbreviations, as documented in code.
- Upload reads the entire file into memory before MinIO upload; the configured file limit is 10 MB.

## 25. Instructions for AI Coding Agents

1. Treat repository implementation as the source of truth.
2. Inspect relevant files before proposing or making changes.
3. Do not assume undocumented behavior.
4. Do not invent APIs, models, functions, configuration, services, or infrastructure.
5. If uncertain, state `UNKNOWN — verify in repository` and inspect the nearest owning code.
6. Prefer existing project patterns over new abstractions.
7. Make the smallest change that satisfies the requirement.
8. Do not modify unrelated files.
9. Preserve the current architecture unless the ticket explicitly requires an architectural change.
10. Add or update tests for behavioral changes.
11. Never weaken or delete tests to make CI pass.
12. Never bypass authorization, validation, privacy, or grounding checks.
13. Never fabricate compliance rules, retrieval results, evidence, vectors, or data.
14. Never log raw PII, credentials, tokens, or provider secrets.
15. Check migrations before changing persistent models or enums.
16. Check transaction boundaries and rollback behavior for database changes.
17. Check concurrency implications for claims, reviews, uniqueness, and shared resources.
18. Check async/sync boundaries before modifying worker or API code.
19. Verify environment-variable changes against settings, Compose, CI, and `.env.example`.
20. Preserve the distinction between PostgreSQL metadata, MinIO objects, Redis queues/events, and external LLM calls.
21. Verify changes with the narrowest relevant test first, then broader repository checks.
22. Explain assumptions and distinguish current behavior from desired behavior.
23. If code and this file disagree, trust the code and flag the documentation discrepancy.
24. Do not update this file merely to make an implementation appear correct. Update it only when the architecture/current behavior genuinely changes.

## Context Document Metadata

- Generated from repository inspection.
- Date generated: 2026-09-20.
- Repository commit SHA inspected: `50423d261eb222adcf508afd294cf85290d5aef1`.
- Major components inspected: backend routes/security/storage/events/config/database/models; Alembic migrations; worker Celery/AI/PII/extraction/chunking/embedding/retrieval/seed code; frontend package/API/SSE code; Compose and Dockerfiles; `.env.example`; CI workflow; backend/worker/frontend tests; fixtures; README and architecture/CI documentation.
- Areas not confidently verified: production deployment; live GitHub branch-protection settings; exact behavior of entrypoint scripts not fully included in this document; full frontend route/component behavior; complete database foreign-key delete/cascade behavior; whether `OFFICER_SIGNUP_CODE` is used outside inspected routes; operational Celery retry/timeout/acknowledgement settings outside repository code.
- When this document conflicts with implementation, inspect the implementation and update the document only after behavior changes are real.