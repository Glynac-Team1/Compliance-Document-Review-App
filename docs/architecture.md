# Architecture — Compliance Document Review App

This document covers three layers of the system:

1. **[Whole-Application Architecture](#1-whole-application-architecture)** — how the frontend, backend, worker, database, and vector store fit together.
2. **[Data / AI Architecture](#2-data--ai-architecture-ingestion--retrieval--generation)** — the ingestion → masking → embedding → retrieval → generation pipeline, the most structurally interesting part of the system.
3. **[Cross-Track Sequence](#3-sequence-submission--decision-cross-track-view)** and **[Document Lifecycle](#4-document-lifecycle-state-machine)** — how a single document moves through the system end to end.

Diagrams are in [Mermaid](https://mermaid.js.org/); they render natively on GitHub and in most Markdown viewers/IDEs (VS Code, Obsidian, etc.).

### Legend

| Color | Layer |
|---|---|
| 🟦 Blue | Client / UI |
| 🟩 Green | Backend API |
| 🟨 Yellow | Async processing (queue/worker) |
| 🟪 Purple | AI / Data pipeline |
| 🟧 Orange | Storage |
| ⬜ Grey | Third-party / external |

---

## 1. Whole-Application Architecture

```mermaid
flowchart TB
    subgraph Client["🟦 Browser — React SPA"]
        AdvUI["Advisor Dashboard<br/>submit · track · notifications"]
        OffUI["Officer Dashboard<br/>queue · split-pane review · AI assist"]
    end

    subgraph EdgeAPI["🟩 FastAPI Backend — session-gated REST"]
        Auth["Auth & Role Middleware<br/>server-side 403 enforcement"]
        DocAPI["Document & Review Endpoints<br/>upload · state machine · decisions"]
        NotifAPI["Notifications Endpoints"]
        AuditAPI["Audit Log<br/>append-only writes"]
    end

    subgraph AsyncLayer["🟨 Async Processing"]
        Queue[["Redis Queue"]]
        Worker["Celery Worker<br/>analyze_document(doc_id)"]
    end

    subgraph AIData["🟪 AI / Data Engineering Pipeline"]
        Extract["Text Extraction<br/>pdfplumber · python-docx · openpyxl"]
        Mask["PII Masker<br/>Presidio + custom regex"]
        Embed["Chunk + Embed<br/>sentence-transformers, local"]
        Retrieve["Vector Retrieval<br/>rules · disclosures · precedents"]
        LLM["LLM Call<br/>Gemini / Groq, JSON-schema output"]
        Unmask["Unmask placeholders<br/>response only"]
    end

    subgraph Storage["🟧 Storage"]
        PG[("PostgreSQL + pgvector<br/>users · documents · reviews · flags<br/>audit_events · notifications<br/>pii_mappings · rules · precedents")]
        Files[("File Storage<br/>local volume / S3-compatible bucket")]
    end

    External[["⬜ Third-party LLM API<br/>Gemini / Groq free tier"]]

    AdvUI -- "HTTPS/JSON" --> Auth
    OffUI -- "HTTPS/JSON" --> Auth
    Auth --> DocAPI

    DocAPI -- "store file" --> Files
    DocAPI -- "row writes" --> PG
    DocAPI -- "enqueue on submit" --> Queue
    Queue --> Worker
    Worker --> Extract --> Mask --> Embed --> Retrieve --> LLM --> Unmask
    Unmask -- "cached summary + flags" --> PG
    Retrieve <-- "similarity queries" --> PG
    Mask -. "pii_mappings<br/>(server-side only)" .-> PG

    DocAPI --> NotifAPI --> PG
    DocAPI --> AuditAPI --> PG

    OffUI -- "GET analysis (poll/cache)" --> DocAPI

    LLM == "masked text ONLY<br/>leaves the app here" ==> External

    classDef client fill:#dbeafe,stroke:#3b82f6,stroke-width:1px,color:#1e3a8a
    classDef api fill:#dcfce7,stroke:#22c55e,stroke-width:1px,color:#14532d
    classDef async fill:#fef9c3,stroke:#eab308,stroke-width:1px,color:#713f12
    classDef ai fill:#f3e8ff,stroke:#a855f7,stroke-width:1px,color:#581c87
    classDef storage fill:#ffedd5,stroke:#f97316,stroke-width:1px,color:#7c2d12
    classDef ext fill:#f1f5f9,stroke:#64748b,stroke-width:2px,stroke-dasharray:4 2,color:#334155

    class AdvUI,OffUI client
    class Auth,DocAPI,NotifAPI,AuditAPI api
    class Queue,Worker async
    class Extract,Mask,Embed,Retrieve,LLM,Unmask ai
    class PG,Files storage
    class External ext
```

### Explanation

- **Client tier** is a single React SPA with role-gated routes; both dashboards call the same FastAPI backend, never the AI pipeline directly.
- **Edge API** is the only thing the browser talks to. Auth middleware runs on *every* request and independently re-verifies role — this is what makes the role boundary hold at the API rather than only in the UI.
- **Async layer** exists because AI analysis cannot sit in the request/response cycle of the upload endpoint: free-tier LLM latency plus rate limits would make `POST /documents` unacceptably slow or flaky. Celery + Redis decouples "save the file and confirm to the advisor" from "run the AI pipeline," with natural retry/backoff semantics.
- **The single most important edge in this diagram** is the thick edge from `LLM` to the external provider, labeled *"masked text ONLY leaves the app here."* Everything upstream (extraction, masking) happens inside the app's own process — nothing crosses the network boundary until after masking. This is architectural enforcement of the privacy wall, not just a coding convention.
- **Storage** is split: Postgres holds all structured/relational/vector data (single system, per the pgvector requirement); raw files live on a separate volume/bucket referenced by `file_reference`, keeping large binary blobs out of the relational database.
- **Graceful degradation** falls naturally out of this shape: if `LLM` fails, the worker writes `ai_analyses.status = error` and the officer-facing `GET /documents/{id}/analysis` endpoint returns a structured `503` — the review UI and decision endpoint never depend on the worker succeeding.

---

## 2. Data / AI Architecture (Ingestion → Retrieval → Generation)

```mermaid
flowchart LR
    subgraph Ingest["🟪 1. Ingestion — Data Engineering"]
        Raw["Raw file<br/>PDF / DOCX / XLSX"]
        Ext["Format-specific extractor"]
        Raw --> Ext
    end

    subgraph Privacy["🟪 2. Privacy Boundary — AI"]
        NER["Presidio NER + regex recognizers<br/>names · emails · phones · SSNs<br/>account numbers · $ near a name"]
        Map[("pii_mappings table<br/>placeholder ↔ real value")]
        Masked["Masked text<br/>[CLIENT_1] used $[AMOUNT_1] ..."]
        Ext --> NER --> Masked
        NER -. "writes mapping" .-> Map
    end

    subgraph Chunk["🟪 3. Chunking + Embedding — Data Engineering"]
        Split["Recursive splitter<br/>atomic chunks for rules,<br/>overlapping window for submissions"]
        Enc["Local encoder<br/>BAAI/bge-small-en-v1.5<br/>384-dim, sentence-transformers"]
        Masked --> Split --> Enc
    end

    subgraph VStore["🟧 pgvector — HNSW, cosine"]
        Rules[("rules<br/>compliance rules,<br/>prohibited claims")]
        Discl[("rules — disclosure type<br/>approved disclosure texts")]
        Prec[("precedents<br/>masked past docs +<br/>decision + comment")]
    end

    subgraph Retrieval["🟪 4. Retrieval — 3 jobs, Data Engineering"]
        R1["Rule retrieval<br/>per document section"]
        R2["Disclosure-by-absence<br/>nearest disclosure > threshold<br/>= missing"]
        R3["Precedent search<br/>top 3 similar past documents"]
    end

    subgraph Gen["🟪 5. Generation — AI"]
        Prompt["RAG prompt =<br/>masked section + retrieved rules"]
        LLMCall["Gemini / Groq<br/>JSON-schema forced output"]
        Validate["Pydantic validation<br/>passage · rule_id · explanation · severity"]
        UnmaskR["Re-inject real values<br/>from pii_mappings<br/>response serialization only"]
    end

    Output[["ai_analyses + flags<br/>cached, one row per document"]]

    Enc --> R1
    Enc --> R2
    Enc --> R3
    Rules <--> R1
    Discl <--> R2
    Prec <--> R3

    R1 --> Prompt
    R2 --> Prompt
    R3 --> Prompt
    Prompt --> LLMCall --> Validate --> UnmaskR
    Map -. "used only here" .-> UnmaskR

    UnmaskR --> Output

    classDef ai fill:#f3e8ff,stroke:#a855f7,stroke-width:1px,color:#581c87
    classDef storage fill:#ffedd5,stroke:#f97316,stroke-width:1px,color:#7c2d12
    classDef out fill:#dcfce7,stroke:#22c55e,stroke-width:1px,color:#14532d

    class Raw,Ext,NER,Map,Masked,Split,Enc,R1,R2,R3,Prompt,LLMCall,Validate,UnmaskR ai
    class Rules,Discl,Prec storage
    class Output out
```

### Explanation

- **Stage 1 (Ingestion)** is format-aware on purpose: a single "extract anything" library produces noisier text than three purpose-built extractors, and noisy text degrades both the masker's regex/NER hit rate and chunk quality downstream. This is the single highest-leverage place to invest DE effort, because every later stage inherits its errors.
- **Stage 2 (Privacy Boundary)** is drawn as its own subgraph deliberately — it is the one stage every other stage's output must pass through before anything touches a network call. `pii_mappings` is written here and *only* read again at the very last stage (`UnmaskR`), which keeps the "real value" data flow short and auditable: one write, one read, both server-side.
- **Stage 3 (Chunking + Embedding)** uses a *local* encoder rather than a hosted embedding endpoint. This is the architecturally significant choice: masked text never leaves the process even for embedding, so the privacy boundary in Stage 2 is airtight for the vector pipeline, not just for the final LLM call. It also decouples bulk corpus seeding (~150 rule/disclosure chunks + ~100 precedent documents) from the free-tier LLM's rate limit entirely — seeding is fast, deterministic, and rerunnable without burning quota.
- **Stage 4 (Retrieval)** runs three distinct jobs against the same table shape but different semantics: rule retrieval is a standard top-k similarity search; disclosure-by-absence *inverts* the usual pattern — presence is inferred from proximity, absence from the lack of any close match above a tuned threshold; precedent search is top-3, fixed by spec. Keeping these as three named jobs (not one generic "search" function) is what makes the threshold-tuning work in `eval_retrieval.py` legible.
- **Stage 5 (Generation)** is where the *only* outbound network call to a third party happens, and it happens on masked text with a forced JSON schema — this is what makes flags traceable (`passage`, `matched_rule_id`, `explanation`) rather than free-text verdicts. Unmasking happens strictly at serialization time, after validation, so a malformed LLM response can never leak into a half-unmasked state.

---

## 3. Sequence: Submission → Decision (cross-track view)

```mermaid
sequenceDiagram
    participant A as 🟦 Advisor (browser)
    participant API as 🟩 FastAPI Backend
    participant Q as 🟨 Redis/Celery
    participant P as 🟪 AI/DE Pipeline
    participant DB as 🟧 Postgres+pgvector
    participant Ext as ⬜ Gemini/Groq
    participant O as 🟦 Officer (browser)

    A->>API: POST /documents (file)
    API->>DB: insert documents(status=pending_review)
    API->>Q: enqueue analyze_document(id)
    API-->>A: 201 Created

    Q->>P: run pipeline
    P->>P: extract text
    P->>P: mask PII (write pii_mappings)
    P->>P: chunk + embed (local)
    P->>DB: similarity search (rules, disclosures, precedents)
    P->>Ext: RAG prompt (masked text only)
    Ext-->>P: structured JSON flags
    P->>P: unmask placeholders
    P->>DB: insert ai_analyses + flags (status=ready)

    O->>API: GET /queue
    API->>DB: select pending documents
    API-->>O: filtered queue

    O->>API: GET /documents/{id}
    API->>DB: insert audit_events(action=viewed)
    API-->>O: original unmasked file

    O->>API: GET /documents/{id}/analysis
    API->>DB: select ai_analyses/flags
    API-->>O: summary + flags (or 503 if not ready/error)

    O->>API: POST /documents/{id}/review (decision, comment)
    API->>DB: insert reviews
    API->>DB: update documents.status
    API->>DB: insert audit_events(action=decided)
    API->>DB: insert notifications(advisor)
    API-->>O: 200 OK

    A->>API: GET /notifications
    API->>DB: select notifications
    API-->>A: decision + comment visible
```

This sequence is the one flow every track's tests should exercise together in Week 2 — it's the shortest path that touches Backend, DE, AI, and Frontend at once.

---

## 4. Document Lifecycle (State Machine)

The `documents.status` column drives what each dashboard shows and which endpoints are allowed to act on a document. This is the state machine `DocAPI` enforces server-side.

```mermaid
stateDiagram-v2
    [*] --> pending_review: Advisor submits

    pending_review --> analyzing: Worker picks up job
    analyzing --> ready: LLM analysis succeeds
    analyzing --> error: LLM/pipeline failure

    error --> analyzing: Retry (Celery backoff)

    ready --> approved: Officer decision = approve
    ready --> rejected: Officer decision = reject
    ready --> needs_changes: Officer decision = request changes

    needs_changes --> pending_review: Advisor resubmits

    approved --> [*]
    rejected --> [*]

    note right of error
        GET /documents/{id}/analysis
        returns structured 503
        while status = error
    end note

    note right of ready
        Officer review UI only
        unlocks once status = ready
    end note
```

### Explanation

- `pending_review` and `analyzing` are distinct: the former means "in queue, nothing running yet," the latter means "worker actively holds this job" — useful for distinguishing a stuck queue from a stuck worker in ops dashboards.
- `error` is a first-class state, not an exception swallowed in logs — it's what lets the API return a deterministic `503` instead of hanging or 500ing, and it's what the retry/backoff policy targets.
- `needs_changes` closes the loop back to `pending_review`, so the same state machine — not a separate "resubmission" flow — handles both first-time submissions and revisions.

---

## Repository Layout Reference

| Path | Owns |
|---|---|
| `frontend/` | React SPA — Advisor & Officer dashboards |
| `backend/api/` | FastAPI routes, auth middleware, state machine |
| `worker/` | Celery tasks, AI pipeline, and `analyze_document` entrypoint |
| `pipeline/ingestion/` | Format-specific extractors |
| `pipeline/privacy/` | Presidio config, custom regex recognizers, `pii_mappings` I/O |
| `pipeline/embedding/` | Chunker, local encoder wrapper |
| `pipeline/retrieval/` | `retrieve_rules.py`, `retrieve_disclosures.py`, `retrieve_precedents.py`, `eval_retrieval.py` |
| `pipeline/generation/` | Prompt templates, LLM client, Pydantic response schema |
| `db/migrations/` | Postgres + pgvector schema |