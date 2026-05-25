# SW Exchange Version History

Current completed milestone: `v0.20 Exchange Boundary + v1/v2 Planning Docs`

Next milestone: `v1.0 Auth Security + Feature Flags`

## Upcoming Plan

- `v1.0 Auth Security + Feature Flags`
- `v1.1 Chain Asset Registry`
- `v1.2 User Deposit Address Model`
- `v1.3 Deposit Monitor Detect-only`
- `v1.4 Deposit Credit Flow`
- `v1.5 Withdrawal Request`
- `v1.6 Withdrawal Approval + Broadcast`
- `v1.7 Gas / Withdrawal Fee Management`
- `v1.8 Chain Reconciliation / Audit`
- `v1.9 Chain Gateway Stabilization`
- `v2.x Optional Margin / Futures Simulation`

## v0.20 Exchange Boundary + v1/v2 Planning Docs

This milestone is documentation and planning only. It defines the public boundary of the project and the intended `v1.x` and `v2.x` roadmap before any chain gateway, security-hardening, or margin/futures implementation work begins.

### Highlights

- Added exchange-boundary documentation that defines what SW Exchange is and is not
- Added a real-exchange gap analysis by module
- Added a feature-flag plan for optional and high-risk capabilities
- Added `v1.x` auth/security, chain gateway, asset registry, custody, indexing, and flow-planning docs
- Added a phased `v1.x` implementation sequence
- Added a `v2.x` optional margin/futures simulation plan
- Kept deposit, withdraw, blockchain, 2FA, email verification, margin, and futures behavior unimplemented
- Kept API behavior, schema, wallet rules, transfer rules, and trading-core behavior unchanged

### Developer And Operational Notes

- This milestone is docs-only and planning-only
- No schema or migration change is required for `v0.20`
- No runtime behavior changed

## v0.19 One-Command Deploy / Docker Production Runtime

This milestone makes the off-chain simulated exchange easier to run as a local or VPS-style production demo without changing trading-core, wallet, transfer, fee, schema, or API behavior.

### Highlights

- Added production-oriented Dockerfiles for the Nest API and Next web app using `pnpm`/Corepack
- Added `docker-compose.prod.yml` with Postgres, API, and web services, persistent Postgres storage, and service health checks
- Added `.env.production.example` plus ignored `.env.production` workflow for deploy-time secrets and admin bootstrap values
- Added `scripts/deploy-local.sh` to build images, start Postgres, run migrations, seed data, and bring up API plus web
- Added `scripts/verify-deploy.sh` to verify compose status, API health, and web reachability
- Kept matching logic, market-order behavior, fee logic, wallet rules, transfer rules, schema, deposit, withdraw, and blockchain behavior unchanged

## v0.18.3 Pre-v1 Stabilization / Release Candidate

- Aligned top-level docs and app-facing milestone/status copy to the release-candidate state
- Clarified that `v0.x` remained off-chain with no deposit, withdraw, blockchain, chain-address, built-in KYC, or fiat-redemption behavior
- Polished route notices, empty states, and workflow guidance without changing runtime behavior
