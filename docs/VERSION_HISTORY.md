# SW Exchange Version History

Current completed milestone: `v1.0.2 Email Verification Foundation`

Next milestone: `v1.0.3 TOTP 2FA Foundation`

## Upcoming Plan

- `v1.0.3 TOTP 2FA Foundation`
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

## v1.0.2 Email Verification Foundation

This milestone adds verified-email state and token delivery foundations without turning verified email into a hard requirement for current login or trading flows.

### Highlights

- Added `email_verified_at` user state plus hashed single-use `email_verification_tokens`
- Added authenticated request and public confirm endpoints for email verification
- Added console/dev mail delivery output for verification links and tokens
- Added user and admin UI visibility for email verification state
- Added email verification security events for requested, sent, confirmed, failed, expired, and reused token outcomes
- Kept 2FA, deposit, withdraw, blockchain, admin role permission execution, margin, futures, shorting, liquidation, and advanced order behavior unimplemented
- Kept trading-core behavior, wallet rules, transfer rules, and fee calculation unchanged

### Developer And Operational Notes

- This milestone includes a schema migration and no seed change
- Raw verification tokens are only shown in dev/console mail output, not in the database or security events
- Email verification is available but not yet enforced for login, trading, or sensitive actions

## v1.0.1 Security Logs + Sensitive Action Model

This milestone adds the security-event logging foundation and the shared sensitive-action policy model needed before future verification and custody work can be safely enforced.

### Highlights

- Added `security_events` database storage for auth and high-impact admin security events
- Added admin-only read endpoints for security events and sensitive-action policy review
- Added shared sensitive-action definitions for future password re-auth, email verification, TOTP 2FA, admin RBAC, and funding controls
- Added sanitized metadata normalization to prevent raw secrets, tokens, OTP data, and private keys from being stored
- Added login success/failure and selected current admin security event recording
- Kept deposit, withdraw, blockchain, 2FA, email verification, admin role permission execution, margin, futures, shorting, liquidation, and advanced order behavior unimplemented
- Kept trading-core behavior, wallet rules, transfer rules, and fee calculation unchanged

### Developer And Operational Notes

- This milestone includes a schema migration and seed-safe read model changes
- Security event logging is additional to existing audit logs and ledger records
- Sensitive-action enforcement is still planned only; the matrix is for display and future rollout planning

## v1.0.0 Feature Flags Foundation

This milestone adds the backend-enforced feature flag foundation required before future optional or high-risk modules can be exposed.

### Highlights

- Added `feature_flags` database storage with seeded canonical flag keys
- Added public and admin read endpoints for current feature availability state
- Added backend feature flag service with fail-closed unknown-flag enforcement behavior
- Added admin UI visibility for grouped and risk-labeled flags
- Kept all future/high-risk flags disabled by default
- Kept deposit, withdraw, blockchain, 2FA, email verification, admin role permission execution, margin, futures, shorting, liquidation, and advanced order behavior unimplemented
- Kept trading-core behavior, wallet rules, transfer rules, and fee calculation unchanged

### Developer And Operational Notes

- This milestone includes a schema migration and seed update
- Feature flag editing is not exposed yet
- Admin visibility exists so operators can verify runtime readiness before later modules are added

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
