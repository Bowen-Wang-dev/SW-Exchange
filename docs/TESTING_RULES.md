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

## Normal Local Sequence

- `docker compose up -d`
- `corepack pnpm db:migrate`
- `corepack pnpm db:seed`
- `corepack pnpm dev`
- `corepack pnpm smoke`

## Production-Style Local Deploy Sequence

- `cp .env.production.example .env.production`
- Edit required secrets/admin bootstrap values in `.env.production`
- `./scripts/deploy-local.sh`
- `./scripts/verify-deploy.sh`

## When To Run Which Command

- `corepack pnpm install`
  - Run when dependencies changed.
  - Ensure `pnpm-lock.yaml` stays aligned.

- `corepack pnpm db:generate`
  - Run only when schema changed.
  - Do not run it as part of normal docs/UI stabilization work.

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

- `./scripts/deploy-local.sh`
  - Run for Docker production-runtime verification work.
  - Builds images, starts Postgres, runs migrations, seeds, and starts API plus web.

- `./scripts/verify-deploy.sh`
  - Run after production-style deploy changes.
  - Checks compose service status plus API/web HTTP reachability.

## UI / Dev Server Hygiene

- For UI-heavy changes, include manual checks in the browser.
- If Next.js becomes stale or inconsistent, restart the web dev server.
- If needed, stop the dev server, clear stale `apps/web/.next`, and restart before rerunning local web checks or smoke.

## Pre-Review / Pre-Commit Hygiene

- Run `git diff --check`.
- Review `git status` for accidental generated output.
- Do not stage:
  - `.env`
  - `.env.production`
  - `.next`
  - `dist`
  - `node_modules`
  - logs
  - `package-lock.json`
  - local sample/reference captures
  - `sample/`

## Scripted Smoke Expectations

- Smoke covers API health, seed presence, auth, airdrop, transfer, fees, order flow, market data, admin controls, market orders, public/protected web routes, and web build checks.
- Smoke failures should be treated as actionable verification failures, not ignored noise.

## Docker Runtime Expectations

- `docker-compose.prod.yml` is for a local/VPS-style production demo, not chain-enabled or real-money production.
- The production deploy flow must keep `http://localhost:3000` for web and `http://localhost:3001/api/health` for the default health path unless explicitly reconfigured.
- Reset the local production stack with `docker compose -f docker-compose.prod.yml --env-file .env.production down -v` only when a clean DB/volume reset is intentionally desired.

## Administrative authorization integration (v1.0.4)

Run `corepack pnpm --filter @sw-exchange/api test:admin` with DATABASE_URL_TEST configured for a dedicated local PostgreSQL test database, migrated with the full journal. The suite refuses development/production identities and missing/non-test targets; it never silently skips. Seed internal assets/markets for existing report/read checks, but do not bootstrap the seeded administrator in this test database: last-super-admin tests create their own isolated active super-admin fixtures. Run the stateful auth and admin suites serially if they share a test database.

The suite uses the compiled real Nest application over HTTP, real guards/JWTs, database constraints, live feature flags and persisted security events. It inventories every admin policy and proves fail-closed behavior on a deliberately policy-free route. Three races verify distinct blocked PostgreSQL backends before releasing the shared lock. A real failing audit trigger verifies transaction rollback; offline bootstrap/recovery is tested as a subprocess. Only suite-created fixtures are removed.

Full smoke includes role registry/capability reads and `/admin/roles`; it preserves its seeded-default feature flag assertions. Use a separate smoke database if isolating all smoke-created trading fixtures from development. Use NEXT_DIST_DIR for independent build output while a dev server runs.

### Security-review remediation regressions

The RBAC suite now creates isolated assets/markets for semantic mutations and actual LIMIT/MARKET fills. It verifies configured fee-owner demotion rejection, continued fee receipt after human suspension, exact fees and participant/FEE-wallet balances, forged forwarding-header rejection, complete-report scope isolation, and effective legacy target ceilings. Additional races cover fee-principal removal versus suspension and a queued target whose authority increases before the second transaction acquires the lock. Test cleanup deletes only its own market/asset/user fixtures and restores narrowed canonical grants. Keep the seeded test admin unbootstrapped during last-super-admin tests; bootstrap only for a separate smoke phase and restore that fixture afterward.
