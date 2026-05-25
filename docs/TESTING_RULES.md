# Testing Rules

## Default Approach

- Prefer targeted checks over heavy full-chain checks during normal development.
- For feature development, run targeted build/smoke relevant to the touched surfaces.
- For commit/push verification, run the appropriate checks without unnecessary reinstall work.

## Environment Expectations

- `corepack pnpm` is the preferred package manager entry in Codespaces.
- Docker/Postgres-backed local database is expected.
- API usually runs at `http://127.0.0.1:3001`
- Web usually runs at `http://127.0.0.1:3000`

## When To Run Which Command

- `corepack pnpm install`
  - Run when dependencies changed.
  - Ensure `pnpm-lock.yaml` stays aligned.

- `corepack pnpm db:generate`
  - Run only when schema changed.

- `corepack pnpm db:migrate`
  - Run only when schema changed and a migration is intentionally part of the task.

- `corepack pnpm db:seed`
  - Run for new local environments or when schema/data reset requires reseeding.

- `corepack pnpm --filter @sw-exchange/shared build`
  - Run when shared types/constants or cross-package contracts change.

- `corepack pnpm --filter @sw-exchange/api build`
  - Run when API code or API-facing types/docs change enough to warrant compile verification.

- `corepack pnpm --filter @sw-exchange/web build`
  - Run when web code or app-facing source changes.

- `corepack pnpm smoke`
  - Run for milestone verification and any change touching multi-surface behavior.
  - Current smoke expects the API and web dev servers to already be running unless an external wrapper starts them.
  - Smoke is designed to be rerunnable against a reused local DB.

## UI / Dev Server Hygiene

- For UI-heavy changes, include manual checks in the browser.
- If Next.js becomes stale or inconsistent, restart the web dev server.
- If needed, clear stale `apps/web/.next` before rerunning local web checks.

## Pre-Review / Pre-Commit Hygiene

- Run `git diff --check`.
- Review `git status` for accidental generated output.
- Do not stage:
  - `.env`
  - `.next`
  - `dist`
  - `node_modules`
  - logs
  - `package-lock.json`
  - local sample/reference captures

## Scripted Smoke Expectations

- Smoke covers API health, seed presence, auth, airdrop, transfer, fees, order flow, market data, admin controls, market orders, public/protected web routes, and web build checks.
- Smoke failures should be treated as actionable verification failures, not ignored noise.
