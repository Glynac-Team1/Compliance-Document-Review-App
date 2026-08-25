# Technical Implementation Plan — Compliance Document Review App

**Program:** Capture the Flag Intern Challenge (Project Phase)
**Timebox:** 4 weeks
**Status:** Approved for Implementation
**Tracks:** Backend · Frontend · AI · Data Engineering · DevOps/Platform

---

## 1. Purpose of This Document

This plan translates the product brief into concrete engineering work: what each track builds, in what order, against what interfaces, and how "done" is verified. Read this alongside `architecture.md` (system + data/AI diagrams) and `README.md` (setup). This document is the source of truth for **who owns what** and **how the pieces connect** — treat the interfaces between tracks (API contracts, table schemas, the masking boundary) as fixed points everyone codes against from Week 1.

---

## 2. Product Recap (one paragraph)

Advisors submit client-facing documents (PDF/DOCX/XLSX, ≤10MB). Each submission is automatically text-extracted, PII-masked, and analyzed by an LLM against a retrieved set of compliance rules, missing-disclosure checks, and historical precedent — producing a cached summary and a list of traceable flags. A Compliance Officer reviews the *original* (unmasked) document alongside this AI assist panel and records the only decision that counts: Approve / Reject / Needs Revision, with a comment. Needs Revision loops the advisor back into a linked resubmission thread. Every step is audited.

---

## 3. Team Structure & Ownership

| Track | Owns | Does NOT own |
|---|---|---|
| **Backend** | Auth (2 fixed roles), session/role enforcement, file upload, document state machine, revision linking, audit log, in-app notifications, all REST endpoints | Extraction logic, embeddings, prompt construction |
| **Frontend** | Advisor dashboard, Officer queue, split-pane review UI, AI Assist panel rendering, loading/error/degraded states | Any server-side validation (must not be the *only* enforcement) |
| **AI** | PII masker, prompt construction, LLM calls (Gemini/Groq), structured JSON flag output, unmasking on response | Chunking/embedding/vector storage internals (consumes them) |
| **Data Engineering** | Text extraction (PDF/DOCX/XLSX), chunking, embedding pipeline, pgvector schema/indexes, the 3 retrieval queries, retrieval-quality tuning, corpus seeding | Prompting the LLM, deciding flag severity language |
| **DevOps/Platform** | docker-compose (app + Postgres/pgvector), env var management, migrations/seed automation, CI | Application logic in any track |

Integration points (masking boundary, vector store schema, AI JSON contract, README) are explicitly **cross-track** — pair rather than hand off blind.

---

## 4. Tech Stack by Track

### 4.1 Backend
| Concern | Choice | Why |
|---|---|---|
| Language/Framework | Python 3.12, FastAPI | Async-native, automatic OpenAPI docs, matches AI/DE stack (shared Pydantic models) |
| ORM | SQLAlchemy 2.0 (async) + Alembic | Async ORM pairs with FastAPI; Alembic gives versioned, repeatable migrations DevOps can run on boot |
| Auth | Session cookies (`itsdangerous`-signed) or JWT via `python-jose`; `passlib[bcrypt]` for hashing | Fixed 2-role model doesn't need OAuth complexity; server-verified role claim in every request |
| File handling | `python-multipart` (FastAPI upload), `python-magic` for MIME sniffing | MIME sniffing beats trusting the file extension — closes an easy bypass of the 10MB/type rule |
| Background jobs | Celery + Redis (or FastAPI `BackgroundTasks` if scope is tight) | Analysis generation must not block the upload response — see §8 |
| Validation | Pydantic v2 | Shared request/response schemas, also usable by AI/DE modules |
| Testing | Pytest + `httpx.AsyncClient` + `pytest-asyncio` | Role-boundary tests hit real endpoints, not mocks |

### 4.2 Frontend
| Concern | Choice | Why |
|---|---|---|
| Framework | React 18 + TypeScript, Vite | Fast dev loop, typed contracts against the FastAPI OpenAPI schema |
| Data fetching | TanStack Query | Built-in loading/error/stale states — directly supports the "graceful degradation" requirement |
| Styling | Tailwind CSS | Fast to build a status-colored data grid and split-pane layout without a design system |
| Routing | React Router, role-gated route wrappers | Isolates Advisor/Officer views client-side (backend still enforces) |
| Type generation | `openapi-typescript` against the FastAPI schema | Frontend and backend can't silently drift out of sync |
| Testing | Vitest + React Testing Library | Cover the degraded-state rendering path explicitly |

### 4.3 AI
| Concern | Choice | Why |
|---|---|---|
| LLM provider | Gemini API via Google AI Studio (primary), Groq (fallback/dev) | Free tier, no production Anthropic credits per constraint |
| Client | `google-genai` SDK (or plain `httpx` for full control over the exact outbound payload — useful for the "show the payload" audit requirement) | Direct `httpx` is worth it here: you must be able to print the literal JSON sent |
| Structured output | Gemini JSON mode / function-calling schema, validated against a Pydantic model on receipt | Forces `{passage, rule_id, explanation, severity}` shape — no free-text parsing |
| PII masking | `presidio-analyzer` + `presidio-anonymizer` (Microsoft), tuned with custom regex recognizers for account/SSN-style numbers and dollar-amounts-near-a-name | Presidio gives a real, testable NER+regex pipeline rather than hand-rolled regex only, while staying within "no production-grade PII detector required" — it's the honest middle ground with documented known misses |
| Retry/backoff | `tenacity` | Free-tier rate limits will be hit; need clean retry before falling back to the error payload |

### 4.4 Data Engineering
| Concern | Choice | Why it's the right fit |
|---|---|---|
| Text extraction | `pdfplumber` (PDF), `python-docx` (DOCX), `openpyxl` (XLSX) | Purpose-built per format beats a generic "extract anything" library for this small format set — more predictable output to hand the masker |
| Chunking | Custom recursive splitter (LangChain's `RecursiveCharacterTextSplitter` as the base) tuned per corpus: ~300 tokens/chunk for rules & disclosures (short, atomic), ~150-word sliding window for submitted documents | Rules/disclosures are single-idea and short — small chunks keep retrieval precise. Submission text needs overlap so a disclosure isn't split across a chunk boundary |
| Embeddings | **Local**: `sentence-transformers` with `BAAI/bge-small-en-v1.5` (384-dim) | This is the deliberate, "impressive" choice over calling a hosted embedding API for every chunk: (1) bulk-seeding ~100 documents + dozens of rules would burn the free LLM tier's rate limit fast if embedded remotely; (2) local embedding is deterministic and reproducible for a graded clean-checkout; (3) it keeps embedding fully inside the masking boundary — masked text never leaves the process at all for this step, which is a stronger privacy story than "masked text sent to a hosted embedder." Documented trade-off: slightly lower embedding quality than a large hosted model — acceptable since retrieval is graded on "finds the right rule," not SOTA benchmark scores. |
| Vector store | PostgreSQL + `pgvector`, HNSW index (`vector_cosine_ops`) | Mandated by the brief; HNSW over IVFFlat because the corpus is small (~150 rules/disclosures + ~100 precedents) and HNSW needs no training step, which matters for a scripted, reproducible seed process |
| Migrations/schema | Alembic (shared with backend), `pgvector`-typed columns via `pgvector.sqlalchemy.Vector` | One migration history for relational + vector tables — avoids two schema-management systems |
| Retrieval tuning harness | Small custom eval script (`scripts/eval_retrieval.py`) that runs known query→expected-rule pairs and reports hit@k | You cannot tune "the present-vs-missing threshold" by feel; this gives DE a number to move and re-measure |
| Corpus generation | One-time script using the same Gemini free-tier key to generate ~40 rules/disclosures and ~100 synthetic sample documents (`Faker` for names/PII to be masked away) | Matches the brief's "budget half a day, LLM-generated corpora, no real client data" instruction |

### 4.5 DevOps/Platform
| Concern | Choice | Why |
|---|---|---|
| Orchestration | Docker Compose: `frontend`, `backend`, `worker` (Celery), `redis`, `postgres` (with `pgvector/pgvector:pg16` image) | Turnkey clean-checkout requirement; `pgvector` official image avoids manual extension install |
| Config | `.env.example` documenting `DATABASE_URL`, `REDIS_URL`, `LLM_API_KEY`, `LLM_PROVIDER`, `SESSION_SECRET`; strict `.gitignore` on `.env` | Prevents credential leakage, self-documents required setup |
| Migrations/seeding on boot | `entrypoint.sh` running `alembic upgrade head` then a seed-check (`if rules table empty: run seed script`) before `uvicorn` starts | Guarantees graders never hit an empty DB |
| CI | GitHub Actions: lint → backend tests → frontend tests → `docker compose up` smoke test | Matches "test suite passes from a clean checkout" as a graded item, automated on every push |

---

## 5. Data Model (authoritative — see `architecture.md` for the ER diagram)

```
users(id, role[advisor|officer], name, email, password_hash, created_at)

documents(id, advisor_id FK->users, status[pending|approved|rejected|needs_revision],
          file_reference, file_type, original_filename, uploaded_at,
          thread_root_id, previous_version_id FK->documents nullable)

reviews(id, document_id FK, officer_id FK->users,
        status[approved|rejected|needs_revision], comment, decided_at)

ai_analyses(id, document_id FK unique, summary, status[pending|ready|error],
            generated_at)

flags(id, analysis_id FK, passage_excerpt, matched_rule_id FK->rules,
      explanation, severity[low|medium|high])

audit_events(id, actor_id FK->users, document_id FK,
             action[submitted|viewed|decided|resubmitted], timestamp)  -- append-only, no UPDATE/DELETE grants

notifications(id, user_id FK->users, document_id FK, message, is_read, created_at)

pii_mappings(document_id FK, placeholder, original_value)  -- server-side only, never joined into any API response to the vendor

rules(id, text, type[disclosure|prohibited_claim|performance_standard],
      embedding vector(384))

precedents(id, document_id FK, masked_text, decision, comment,
           embedding vector(384))
```

Key constraints to encode at the DB level, not just app level:
- `audit_events`: `REVOKE UPDATE, DELETE` for the app's DB role — enforce append-only in Postgres itself.
- `documents.previous_version_id` self-reference + `thread_root_id` denormalized on every row in a thread, so "give me the whole thread" is a single indexed query, not a recursive walk on every page load.
- `pii_mappings` never appears in any Pydantic response model used by AI-facing code paths — enforce with a lint rule / code review checklist, not just discipline.

---

## 6. Document Lifecycle & State Machine (Backend)

```
PENDING_REVIEW → (officer decides) → APPROVED        [terminal]
                                    → REJECTED         [terminal]
                                    → NEEDS_REVISION → advisor resubmits → new document row,
                                                        previous_version_id = old.id,
                                                        thread_root_id = old.thread_root_id,
                                                        status = PENDING_REVIEW
```

Rules:
- Only `pending_review` documents are officer-actionable; enforce in the endpoint, not just by hiding the button.
- A resubmission is a **new row**, not an edit of the old one — the old row is immutable history.
- Every transition writes exactly one `audit_events` row and, on officer decisions, exactly one `notifications` row for the advisor.

---

## 7. API Contract (Backend, consumed by Frontend/AI)

| Endpoint | Role | Purpose |
|---|---|---|
| `POST /auth/signup` | public | Create user with fixed role |
| `POST /auth/login` | public | Session/JWT issuance |
| `POST /documents` | advisor | Upload; triggers async analysis job |
| `GET /documents/mine` | advisor | Dashboard list + status |
| `GET /documents/{id}/thread` | advisor, officer | Full revision thread |
| `GET /queue` | officer | Filterable pending queue |
| `GET /documents/{id}` | officer | Original file + metadata (logs a `viewed` audit event) |
| `GET /documents/{id}/analysis` | officer | Cached AI summary/flags; `202` while pending, `503 {error_type}` on AI failure |
| `POST /documents/{id}/review` | officer | Record decision + comment; triggers notification |
| `GET /notifications` | advisor | Unread + read list |
| `POST /notifications/{id}/read` | advisor | Mark read |

Every officer-only endpoint hit by an advisor session (and vice versa) must return **403**, verified by tests, not merely absent from the advisor's UI.

---

## 8. Async AI Pipeline (cross-cutting: Backend triggers, DE builds retrieval, AI generates)

1. `POST /documents` saves the file, creates the `documents` row (`pending_review`), enqueues `analyze_document(document_id)`.
2. Worker: DE's extraction util pulls raw text → AI's masker replaces PII with placeholders, persists `pii_mappings` → DE's chunker/embedder embeds masked text.
3. DE's three retrieval queries run against `rules` and `precedents` (cosine similarity, `LIMIT` per task; precedent count fixed at 3).
4. AI builds the RAG prompt (masked text + retrieved rule/disclosure snippets) → calls Gemini with a JSON schema → validates response → unmasks placeholders in the flag text for storage/display.
5. Result written to `ai_analyses` + `flags` (status `ready`), or `status = error` with a logged reason on failure/timeout — the officer-facing endpoint returns `503 {error_type: "ai_unavailable"}` in that case, never a blocking wait.
6. Frontend's Assist panel polls or uses TanStack Query's retry to reflect `pending → ready/error`.

This flow is the one piece every track touches — build it in Week 2 with a shared integration test (`test_analysis_pipeline.py`) that all four contributing tracks can run locally.

---

## 9. Milestones (aligned to the brief's 4-week shape)

**Week 1 — The boring half.** Auth + 2 roles, server-side role gate returning 403, file upload with size/type validation, both dashboards (no AI). Exit criteria: a document can be submitted and manually decided end-to-end.

**Week 2 — AI path end to end.** Extraction, masking (with a printable outbound payload), rule corpus seeded, embedding pipeline live, retrieval wired, summary + flags rendering in the review panel from a real (not mocked) pipeline run.

**Week 3 — Compliance-tool behaviors.** Disclosure-by-absence detection, precedent search (top 3), revision threads, audit trail, queue filtering, error/empty/degraded states, kill-the-API-key manual test passes.

**Week 4 — Hardening.** Role-boundary and masker test suites, retrieval-quality tuning pass (`eval_retrieval.py` hit@k), README clean-checkout dry run by someone outside the team, CI green.

---

## 10. Testing Requirements (minimum bar, all tracks)

- **Role boundary:** advisor→officer endpoint and officer→advisor endpoint both assert `403`, at the API layer.
- **Masker:** unit tests over seeded fake names/emails/phones/SSN-style numbers/account numbers/dollar-amounts-near-a-name, plus a documented list of known misses (e.g., unusual name formats, non-US phone formats).
- **State machine:** every legal transition has a test; illegal transitions (e.g., deciding twice) are rejected.
- **Degradation:** with `LLM_API_KEY` unset, `GET /documents/{id}/analysis` returns `503` and the review page still renders and accepts a decision (frontend test + manual checklist item).
- **Payload proof:** a test or script that prints the literal JSON body sent to the LLM provider for a document seeded with fake PII, asserting the real values are absent.

---

## 11. Out of Scope (explicitly, per brief)

Semantic diffing of revisions, cross-advisor near-duplicate clustering, per-officer routing/assignment. Do not build these unless everything above is done and tested.