# Compliance Document Review App

A workspace-based compliance review system for financial documents. The application combines document intake, invitation-based onboarding, and asynchronous AI-assisted review with a required human decision by the Compliance Officer.

This project is designed for teams that need a practical review workflow: an admin creates a workspace, invites members, a financial advisor uploads a document, and a compliance officer reviews AI-generated findings before making the final decision.

## Live Demo

Open the deployed application here:

- https://compliance-document-review-app-seven.vercel.app/

For deeper implementation details, see [docs/architecture.md](docs/architecture.md) and [docs/technical-implementation-plan.md](docs/technical-implementation-plan.md).

---

## Overview

This application helps organizations review uploaded compliance documents in a structured, role-based workflow. It is not intended to replace human judgment: the AI helps flag issues, but the Compliance Officer remains responsible for the final approval, rejection, or revision decision.

The system includes:

- workspace and member management
- document upload and tracking
- role-based access for Admin, Financial Advisor, and Compliance Officer
- asynchronous document analysis through a background worker
- retrieval-augmented compliance checks against rules and precedents
- audit trails, notifications, and review-state tracking

The product is oriented toward a realistic internal review process rather than a fully autonomous AI reviewer.

---

## Key Features

- Workspace creation and multi-member onboarding
- Role-based access for administrators, advisors, and officers
- Email-based invitation flow using Brevo, with a direct invite-link fallback when email delivery fails
- Secure registration after invitation acceptance
- Financial Advisor upload of PDF, DOCX, and XLSX files
- Compliance Officer dashboard with review queue and document lock/claim workflow
- Asynchronous AI analysis in the background
- RAG-based retrieval of policy/rule context and precedents
- PII masking before outbound AI requests
- Structured findings and summary output for human review
- Audit trail, notifications, and document revision tracking
- Graceful degraded states when analysis fails or required context is unavailable

---

## User Guide

This is the core workflow of the application, in the order a real user would experience it.

### 1. Create a Workspace

The workspace administrator creates a workspace for the organization and becomes the designated workspace admin. This establishes the tenant boundary for members, documents, and review activity.

From the app, the admin creates the workspace and sets the initial administrative account.

### 2. Invite Members

Once the workspace exists, the admin invites members by email. The application uses Brevo for transactional invitation emails, but it also exposes a direct invite link as a fallback when email delivery is not successful.

The invitation is role-scoped:

- Financial Advisor
- Compliance Officer

The backend stores an invitation token with a short expiry window and returns a direct link that can be copied and shared manually if email delivery fails.

### 3. Accept the Invitation

The invited person receives the invite and opens the link. The app validates the token and confirms the target workspace and role before continuing.

### 4. Register an Account

After accepting the invitation, the user creates their account and password. The system binds them to the assigned workspace and role, rather than allowing open self-registration into a workspace.

### 5. Upload a Compliance Document

The Financial Advisor uploads a compliance document from their workspace dashboard. Supported formats are PDF, DOCX, and XLSX, with a practical file-size limit enforced by the application.

Once the file is submitted, it is stored and queued for AI-assisted review. The advisor can later track the status of the document through the workspace.

### 6. Review the Document

The Compliance Officer sees the uploaded document on the Officer Dashboard. They can view the queue, select a document, and claim it before reviewing to avoid duplicate review activity.

When the officer clicks Review, the app opens the document together with the AI-generated findings and analysis summary.

### 7. AI Analysis

The analysis runs asynchronously in the background. The worker extracts text, masks personal information, chunks the text, retrieves relevant compliance rules and prior context, and calls the LLM with masked content plus retrieved context.

The output is presented as decision support to the officer. It helps highlight policy concerns, missing disclosures, and other issues, but it does not make the final compliance decision.

### 8. Manual Decision

The Compliance Officer manually reviews the AI output, checks the original document, and records the final decision:

- Approve
- Reject
- Needs Revision

This final decision is the action that matters. The AI supports the review process; the human reviewer makes the binding call.

---

## AI Analysis Examples

The system analyzes uploaded compliance documents and produces findings that help the Compliance Officer review the document faster and with more context.

### Compliant Document

This example shows an AI-assisted review of a document that does not raise significant compliance issues.

![Compliant document AI analysis example](docs/compliant-ai-output-sample.png)

*Example output for a compliant document: the AI summary and issue list remain limited or empty when the content aligns with the expected compliance context.*

### Non-Compliant Document

This example shows a document with likely compliance concerns that the officer should review manually.

![Non-compliant document AI analysis example](docs/non-compliant-ai-output-sample.png)

*Example output for a non-compliant document: the AI flags missing disclosures, policy mismatches, or risky wording that requires human review and final judgment.*

---

## How It Works

The application follows a straightforward workflow from onboarding to final decision.

```mermaid
flowchart LR
    A[Admin creates workspace] --> B[Admin invites member]
    B --> C[Member accepts invite]
    C --> D[Member registers account]
    D --> E[Advisor uploads document]
    E --> F[Document enters review queue]
    F --> G[Officer clicks Review]
    G --> H[Background worker analyzes document]
    H --> I[Rules + precedents retrieval]
    I --> J[AI summary and findings]
    J --> K[Officer makes final decision]

    subgraph Backend
        F --> L[(PostgreSQL + pgvector)]
        E --> M[(MinIO object storage)]
        H --> N[Celery worker]
        N --> I
    end

    subgraph AI
        I --> O[LLM analysis]
        O --> J
    end
```

At a system level, the flow is:

Frontend → API → PostgreSQL / object storage → Celery worker → retrieval + policy context → LLM analysis → stored results → Compliance Officer review

---

## RAG / AI Pipeline

The AI pipeline is implemented as a retrieval-augmented compliance review workflow.

1. Document extraction: PDF, DOCX, and XLSX files are converted into text.
2. PII masking: names, emails, phone numbers, account identifiers, and monetary values are masked before any external LLM request.
3. Chunking and embedding: the masked text is broken into chunks and encoded with a local embedding model.
4. Vector retrieval: the system searches relevant compliance rules, disclosures, and precedent content from the database/vector store.
5. Compliance context assembly: the most relevant retrieved context is passed alongside the document text.
6. LLM analysis: the model produces a structured summary and flagged findings.
7. Output validation: the result is validated against a schema before being stored.
8. Result persistence: the analysis summary and findings are saved for the officer review interface.

This is designed to support the officer, not replace their decision-making.

---

## Technology Stack

| Technology | Purpose |
| --- | --- |
| Next.js 16 | Frontend application and dashboard experience |
| TypeScript | Frontend type safety |
| FastAPI | Backend REST API |
| SQLAlchemy | Async database access and ORM model layer |
| PostgreSQL + pgvector | Relational storage and vector similarity search |
| Redis | Queueing and async task coordination |
| Celery | Background document analysis processing |
| MinIO | Object storage for uploaded documents |
| Docker Compose | Local development environment |
| Brevo API | Transactional invitation emails |
| Gemini / Groq / OpenRouter | Optional LLM providers for AI analysis |
| PII masking utilities | Privacy protection before AI processing |
| Vitest + ESLint | Frontend validation |
| Pytest + Ruff | Backend and worker validation |

---

## Project Architecture

The repository is separated into a few clear layers:

- frontend/: Next.js app for admin, advisor, and compliance-officer views
- backend/: FastAPI application, auth, API routes, database models, and security logic
- worker/: Celery worker and AI/data engineering components for document analysis
- models/: shared database models and schema definitions
- docs/: architecture and process documentation
- docker-compose.yml: application stack for local development

The backend and frontend enforce role boundaries and workspace scoping, while the worker handles asynchronous analysis work. The same document and review data is shared across the user-facing workflows without bypassing the API-level authorization checks.

---

## Local Development

### Prerequisites

- Git
- Docker Engine or Docker Desktop with Compose v2
- At least 4 GB of RAM available for containers
- An LLM API key if you want AI analysis enabled locally

### Clone and Configure

```bash
git clone <repository-url>
cd Compliance-Document-Review-App
```

Create a `.env` file with the required values for local development:

```dotenv
SESSION_SECRET=replace-with-a-long-random-value
OFFICER_SIGNUP_CODE=replace-with-a-strong-one-time-code
LLM_API_KEY=your-provider-key
LLM_PROVIDER=gemini
BREVO_API_KEY=
BREVO_SENDER_EMAIL=no-reply@example.com
BREVO_SENDER_NAME="Northstar Compliance"
FRONTEND_URL=http://localhost:3000
PUBLIC_STORAGE_URL=http://localhost:9000
```

Notes:

- `LLM_API_KEY` is optional if you only want the non-AI scaffold to run.
- `OFFICER_SIGNUP_CODE` is required for creating a compliance officer account in the local environment.
- The Compose file provides local database, Redis, and MinIO defaults.

### Start the App

```bash
docker compose up --build
```

This starts the PostgreSQL, Redis, MinIO, backend, worker, and frontend containers. The backend container runs Alembic migrations before starting, and the worker waits for services to become healthy before beginning analysis work.

### Health Check and Access

Check the API:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"ok"}
```

Open these in a browser:

- Frontend: http://localhost:3000
- Admin: http://localhost:3000/admin
- Advisor workspace: http://localhost:3000/advisor
- Compliance Officer workspace: http://localhost:3000/compliance-officer
- API docs: http://localhost:8000/docs

### Manual Database / Migration Notes

If running the backend outside Docker, the project expects PostgreSQL and Redis to be available. The repository docs include checks such as:

```bash
export DATABASE_URL=postgresql+asyncpg://compliance:compliance@127.0.0.1:5432/compliance_review
export REDIS_URL=redis://127.0.0.1:6379/0
export SESSION_SECRET=local-only-session-secret
export OFFICER_SIGNUP_CODE=local-only-officer-code
export ENVIRONMENT=test
export PYTHONPATH=backend
python -m alembic upgrade head
```

---

## Deployment

The project is live and available here:

- https://compliance-document-review-app-seven.vercel.app/

The repository also includes local Docker-based development and CI validation for running the app and testing it in a local environment.

---

## Testing

The repository includes both backend/worker tests and frontend tests.

### Python tests

```bash
PYTHONPATH=backend python -m pytest backend/tests worker/ai worker/data_eng -v
```

### Frontend checks

From the frontend directory:

```bash
cd frontend
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
```

The project also includes CI checks for linting, migrations, Docker validation, and frontend build/test validation. See [docs/ci-cd.md](docs/ci-cd.md) for the full local validation workflow.

---

## Project Structure

```text
.
├── backend/
│   ├── app/
│   ├── alembic/
│   ├── models/
│   └── tests/
├── frontend/
│   ├── app/
│   ├── components/
│   └── lib/
├── worker/
│   ├── ai/
│   ├── data_eng/
│   └── scripts/
├── docs/
├── docker-compose.yml
├── README.md
├── pyproject.toml
└── .github/
```

---

## Security / Reliability Considerations

The codebase includes several practical safeguards:

- PII masking before outbound LLM analysis
- Role-based access enforcement in the backend
- Workspace-level scoping for members and documents
- Background processing to avoid hard dependency on slow AI calls in the request cycle
- Retry and fallback strategies in the worker/AI layer
- Structured error handling for extraction, retrieval, and LLM failures
- Manual review requirement before a final decision is recorded
- Audit logging of review actions and document state changes

These are not a substitute for production hardening, but they are real implementation safeguards already present in the project.

---

## Known Limitations

This project is a strong portfolio and team development effort, but it is not presented as a production-grade deployment system. Important known limitations include:

- AI outputs are used for decision support, not autonomous approval
- Some business and regulatory edge cases remain domain-specific and require human review
- LLM-based analysis depends on provider availability, keys, and retrieval quality
- Invitation email delivery depends on external email infrastructure and may fail; the direct invite-link fallback is the built-in workaround

---

## Team / Contribution

This project was developed as a multi-track team effort across backend, frontend, AI, data engineering, and DevOps responsibilities.

From the repository documentation, the major tracks are:

- AI Engineering: masking, output validation, LLM integration, and failover logic
- Backend Engineering: API governance, workspace authorization, document lifecycle, and async workflow orchestration
- Frontend Engineering: dashboards, review UI, routing, notifications, and admin experience
- Data Engineering: extraction, chunking, embeddings, and retrieval logic
- DevOps / Platform: Docker, Alembic, Compose, and CI setup

The repository structure reflects that split, with distinct responsibilities across backend, frontend, worker, and docs.

---

## Further Reading

- [docs/architecture.md](docs/architecture.md)
- [docs/technical-implementation-plan.md](docs/technical-implementation-plan.md)
- [docs/ci-cd.md](docs/ci-cd.md)
- [worker/ai/README.md](worker/ai/README.md)

This README is intended to be practical for both end users and technical reviewers: it explains the actual workflow in plain language and provides enough architecture context for engineers and recruiters to understand the project quickly.
