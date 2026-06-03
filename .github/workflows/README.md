# CI Workflows

## `ci.yml`

Runs on every push to `main` and every pull request targeting `main`.

### Jobs (parallel)

| Job | Steps |
|---|---|
| **backend** | Python 3.13 → install `requirements-dev.txt` → Django `check` + `migrate` → `pytest` (28 tests) |
| **frontend** | Node 20 → `npm ci` → `npm run build` (typecheck + bundle) → `npm test` (Vitest 14 tests) |

### Caching
- pip cache keyed on `backend/requirements*.txt`
- npm cache keyed on `frontend/package-lock.json`

### Local equivalence
You can run the same checks locally:

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm run build && npm test
```
