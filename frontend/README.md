# Compliance Document Review Frontend

This is the Next.js 16 App Router frontend for the Compliance Document Review
application. It provides advisor uploads and document tracking, the officer review
queue, AI Assist results, manual decisions, workspace administration, and live
notification/synchronization updates.

## Run locally

The recommended workflow runs the frontend through the repository Compose file:

```bash
docker compose up --build frontend backend worker
```

Open <http://localhost:3000>. The frontend container talks to the backend at
`http://localhost:8000` through the existing API configuration.

For frontend-only development, install dependencies in this directory and start
Next.js:

```bash
npm ci
npm run dev
```

## Main routes

| Route | Purpose |
| --- | --- |
| `/login` | Sign in |
| `/create-workspace` | Create the initial workspace administrator |
| `/accept-invite` | Accept a workspace invitation |
| `/advisor` | Upload and track documents and revisions |
| `/compliance-officer` | Claim documents, inspect AI Assist, and make decisions |
| `/admin` | Manage workspace members and invitations |

The backend remains authoritative for authentication, role checks, workspace
isolation, uploads, analysis status, and review decisions. Frontend route guards
improve UX but are not a security boundary.

## Analysis states

The officer review panel handles pending, ready, and failed AI analysis. Failed
analysis responses may include `error_code`, `user_facing_error`, and
`manual_review_required`. The UI displays the persisted cause-specific message and
keeps the manual decision flow available; it does not treat an error as a normal
compliance result.

## Validation

Run these commands from `frontend/`:

```bash
npm run lint
npx tsc --noEmit
npm test -- --run
npm run build
```

The Vitest suite includes degraded-state rendering coverage in
`__tests__/degraded-state.test.tsx`.
