# CI/CD and Branch Protection

This repository currently implements continuous integration only. There is no
production hosting target or deployment credential in the repository, so deployment
is intentionally left for a future CD workflow rather than being guessed here.

## CI workflow

`.github/workflows/ci.yml` runs for pull requests targeting `main` and for pushes to
`main`. It has three required validation jobs:

| Job | Checks |
| --- | --- |
| `Python lint, migrations, and tests` | Installs backend and worker requirements, runs Ruff, applies Alembic migrations to a temporary PostgreSQL/pgvector service, seeds the synthetic integration-test corpora, and runs backend plus worker tests. |
| `Frontend validation` | Runs `npm ci`, ESLint, strict TypeScript validation, Vitest, and the Next.js production build. |
| `Docker build and Compose validation` | Validates Compose interpolation with CI-only values and builds the backend, worker, and frontend images. |

The workflow uses no provider API key. Tests that cover missing-LLM-key degradation
run with `LLM_API_KEY` empty. The PostgreSQL service uses disposable credentials and
is destroyed with the runner after the job. CI-only values must not be reused for
development or production.

## Developer workflow

Create a short-lived feature branch from an up-to-date `main` branch:

```bash
git switch main
git pull --ff-only
git switch -c feature/short-description
```

Push the branch and open a pull request targeting `main`. GitHub Actions reports each
job separately, so a failure points to the relevant lint, test, migration, frontend,
or Docker step. Fix the failing check, push again, and wait for all three jobs to pass
before merging.

## Local validation

The Python integration checks need a running PostgreSQL 16 + pgvector database. The
following commands reproduce the important Python checks after dependencies are
installed:

```bash
python -m pip install --requirement backend/requirements.txt --requirement worker/requirements.txt ruff==0.11.2
export DATABASE_URL=postgresql+asyncpg://compliance:compliance@127.0.0.1:5432/compliance_review
export REDIS_URL=redis://127.0.0.1:6379/0
export SESSION_SECRET=local-only-session-secret
export OFFICER_SIGNUP_CODE=local-only-officer-code
export ENVIRONMENT=test
export PYTHONPATH=backend
python -m ruff check backend worker scripts
python -m alembic upgrade head
python -m worker.data_eng.seed_rules_corpus
python -m worker.data_eng.seed_precedents_corpus
python -m pytest backend/tests worker/ai worker/data_eng -v
```

The same database and corpus setup can be provided by the repository's Compose
environment. For container validation:

```bash
SESSION_SECRET=local-only-session-secret OFFICER_SIGNUP_CODE=local-only-officer-code docker compose config --quiet
SESSION_SECRET=local-only-session-secret OFFICER_SIGNUP_CODE=local-only-officer-code docker compose build backend worker frontend
```

Frontend checks run from `frontend/`:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Protecting `main`

Branch protection is a repository setting and cannot be safely configured from a
workflow file. In GitHub, open **Settings > Branches > Add classic branch protection
rule** (or the equivalent ruleset) for `main` and enable:

- Require a pull request before merging.
- Require at least one approving review for team-owned changes.
- Dismiss stale approvals when new commits are pushed, where appropriate.
- Require status checks to pass before merging and require branches to be up to date.
- Mark these exact checks as required: `Python lint, migrations, and tests`,
  `Frontend validation`, and `Docker build and Compose validation`.
- Restrict direct pushes to the maintainers or automation that genuinely needs them.
- Do not allow force pushes or deletion of `main`.

Use repository/team permissions to decide who can bypass the rule. Keep bypasses
limited to repository administrators and document any exception. Apply the rule to
administrators too if the team’s operating model permits it.

## Secrets and future CD

`.env` and other environment-specific files are ignored; `.env.example` contains
placeholders only. Do not add provider keys to the repository or CI defaults. When a
real deployment target exists, add a separate protected-environment CD workflow that
uses GitHub Environment secrets, explicit deployment permissions, and a documented
rollback path. The current CI workflow deliberately does not deploy from `main`.