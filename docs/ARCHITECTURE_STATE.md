# Architecture State

Current milestone: `v1.0.4 Admin Role Permissions`

## Current Stack

- Monorepo: `apps/api`, `apps/web`, `packages/shared`
- API: NestJS 11, TypeScript, JWT auth, class-validator
- Web: Next.js 15 App Router, React 19, Tailwind CSS 4
- Data: PostgreSQL + Drizzle ORM
- Shared constants: `@sw-exchange/shared`
- Charts: `lightweight-charts`
- Local workflow: PostgreSQL 16 through Docker Compose or native macOS, `corepack pnpm`, scripted smoke and isolated auth integration tests
- Production-style demo runtime: `docker-compose.prod.yml` with Postgres, API, web, deploy, and verify scripts

## Current Completed Milestones

- `v0.17 Professional Trading Terminal Layout`
- `v0.17.1 Smoke Idempotency / Local DB Test Stability`
- `v0.17.2 Portfolio / Asset Display Polish`
- `v0.17.3 Markets Sorting / Favorites Polish`
- `v0.17.4 Trading Interaction Polish`
- `v0.18 AI-Native Project Docs / Codex Context Pack`
- `v0.18.1 Light Mode / Theme Polish`
- `v0.18.2 Admin Operations / Risk Controls Polish`
- `v0.18.3 Pre-v1 Stabilization / Release Candidate`
- `v0.19 One-Command Deploy / Docker Production Runtime`
- `v0.20 Exchange Boundary + v1/v2 Planning Docs`
- `v1.0.0 Feature Flags Foundation`
- `v1.0.1 Security Logs + Sensitive Action Model`
- `v1.0.2 Email Verification Foundation`
- `v1.0.3 TOTP 2FA Foundation`
- `v1.0.4 Admin Role Permissions`

## Public Product Positioning

- SW Exchange is a simulated exchange runtime for custom assets and custom markets.
- Current `v0.x` behavior is off-chain and uses internal accounting only.
- The system is already a complete off-chain spot-style exchange runtime within that boundary.
- Future `v1.x` work may add optional chain token gateway capabilities.
- Future `v2.x` work may add optional margin and futures simulation behind feature flags.

## Current Supported Assets / Markets

- Seeded assets: `SWC`, `SWL`, `SWD`
- Seeded markets: `SWL/SWC`, `SWD/SWC`
- Admins can create additional internal assets and spot markets
- Current valuation logic is `SWC`-quoted only

## Current Trading Features

- Spot trading only
- Multi-market limit orders
- Multi-market market-order taker flow
- Order preview for `LIMIT` and `MARKET`
- Current-user order cancellation
- Current-market bulk cancel in UI via per-order cancel requests
- Order book, recent trades, ticker, candles, order/trade history

## Current Order Types

- `LIMIT`
- `MARKET`

## Current Market Data Features

- `GET /api/order-book`
- `GET /api/markets/ticker`
- `GET /api/markets/summary`
- `GET /api/markets/candles`
- Trade-derived 24h stats
- Best bid / best ask from open limit orders
- Candles computed from settled trades on demand

## Current Wallet Model

- Normal users: `MAIN` only
- Admin user: `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, `HOT`
- Balances split into `availableBalance` and `lockedBalance`
- New active assets eagerly create zero-balance wallet coverage for users and admin buckets
- `HOT` is still a placeholder bucket in `v0.x`; it does not have live chain behavior

## Current User Status Model

- `ACTIVE`
- `FROZEN`
- `BANNED`

## Current Asset Status Model

- Asset status is effectively `ACTIVE` or `PAUSED` (`isActive` boolean in storage)

## Current Market Status Model

- `ACTIVE`
- `PAUSED`

## Current Admin Features

- Admin login, ACTIVE account boundary and globally protected routes with 34 explicit permission policies
- Viewer/operator/super-admin assignments, current capabilities, permission visibility and confirmed role management
- PostgreSQL serialization, last-super-admin protection, session-version revocation and reviewed offline recovery
- User status controls
- Asset pause/resume
- Asset metadata editing
- Asset creation
- Market pause/resume
- Market creation
- Fee settings review/update
- Admin airdrop
- Admin wallet bucket transfers
- Safer admin confirmations for high-impact actions
- Admin filtering/search on users, assets, markets, audit logs, and ledger
- Admin reports, ledger, trades, transfers, orders, audit logs
- Admin feature flag visibility page and read endpoints

## Current Feature Flag Foundation

- Database-backed `feature_flags` table seeded with canonical future-module flags
- Public `GET /api/feature-flags` endpoint for safe frontend visibility
- Admin `GET /api/admin/feature-flags` endpoint for protected runtime review
- Backend `FeatureFlagsService` with `getAllFlags`, `getFlag`, and fail-closed `assertFeatureEnabled`
- All currently gated future/high-risk flags default disabled

## Current Security Foundation

- Database-backed `security_events` table for security-focused auth/admin event capture
- Backend `SecurityEventsService` with sanitized metadata normalization and admin read queries
- Email verification foundation with `email_verified_at`, hashed single-use tokens, authenticated request flow, and public confirm flow
- Console/dev mail delivery abstraction for verification links and tokens
- Current runtime emits security events for successful login, failed login, email verification request and confirm outcomes, user status changes, asset status changes, market status changes, fee setting updates, admin airdrops, and admin wallet bucket transfers
- Admin `/admin/security-events` page exposes read-only filtered review
- Admin users UI now shows email verified or unverified status
- User-bound AES-256-GCM TOTP secrets, hashed login challenges/recovery codes/reauthentication tokens, and user-row-serialized consumption
- Five-minute login challenges with five attempts and persisted TOTP replay counters
- Fresh purpose-bound password reauthentication for setup, enable, disable and recovery-code regeneration; disable/regeneration also require a valid factor
- Enable/disable increment authVersion and return a replacement session; earlier JWTs are rejected
- Login, factor and password-reauthentication rate limits; startup/hourly retention cleanup
- Dashboard security controls, two-step login, admin 2FA status visibility, and TWO_FACTOR security events
- Admin RBAC and purpose-bound role reauthentication are implemented; enforced email and future funding policies remain planned-only

## v1.0.4 Independent Review Remediation

- Second review: durable role-reauthentication password/factor accounting completes before taking the user-row lock. Setup/enable flag reads reuse their existing transaction connection. This removes a pool dependency cycle without increasing production pool size/timeouts or weakening authentication.
- Complete fee-settings reads require fees.read + wallets.read; both mutation aliases additionally require fees.manage because their responses also contain balances. Complete-report isolation and shipped grants remain unchanged.
- Administrator freeze/ban/reactivation/no-op status requests recheck actor and effective target authority inside the protected transaction, including legitimate legacy fallback. Queued target promotions cannot bypass the ceiling; ordinary user management and session/last-super/fee-principal invariants remain intact.
- Locked role changes protect the configured fee-principal ADMIN identity with 409; status suspension still revokes human access while preserving fee receipt and independent last-super-admin protections.
- Central audit attribution uses the socket peer, with no untrusted forwarding-header fallback or implicit trusted proxy.
- Complete reports require six underlying resource scopes before any report query; aggregate counters stay separate.
- Legacy-aware target authority uses the same capability resolver/transaction connection as authorization; USER identities never receive fallback.
- Semantic authorization and real isolated LIMIT/MARKET fill tests supplement the 34-route inventory, including a queued target-authority race.
- No new schema, fee formulas, matching/accounting rules or chain features. See [remediation evidence](./V1_0_4_REMEDIATION.md).

## Current UI State

- Dark-first exchange style with alternate Light mode
- Desktop-first terminal on `/trade`
- Compact ticker strip, dominant chart, adjacent order book / tape, fixed order rail
- Bottom trading activity tabs
- Portfolio and markets views are searchable and sortable
- Admin operations pages are filterable and use confirmation dialogs for high-impact actions
- Favorites on `/markets` are local browser state
- Theme preference is stored in `localStorage`

## Current System Constraints

- Internal simulation only
- Off-chain internal-accounting model only
- No deposit / withdraw / blockchain behavior
- No chain listeners, chain addresses, or token gateway runtime
- No real-money redemption, fiat flow, or built-in KYC workflow
- Optional TOTP 2FA is implemented; enrollment is gated by enable2FA, existing enabled accounts always require a second factor
- Granular admin roles/permissions are implemented; assigned roles are always enforced and enableAdminRolePermissions additionally gates unassigned legacy administrator access
- Email verification is available but is not required for login, trading, transfer, or admin actions yet
- No margin / futures / leverage behavior
- No real-time event bus; web UI uses polling and manual refresh paths
- No candle aggregation table; candles come from trades
- Transfers are normal-user/admin `MAIN` wallet flows only
- User-facing transfer form currently supports `SWC` and `SWL` only

## Planning Documents Added In v0.20

- Public exchange boundary and exclusions
- Real-exchange gap analysis by module
- Feature-flag plan for optional and high-risk modules
- `v1.x` auth/security plan
- `v1.x` chain gateway architecture, registry, custody, and flow planning
- `v1.x` phased implementation sequence
- `v2.x` optional margin/futures simulation plan

## Current Milestone

- Current completed milestone: `v1.0.4 Admin Role Permissions`
- Next planned milestone: `v1.1 Chain Asset Registry` (planned-only)
- `v1.0.4` adds explicit roles, globally fail-closed admin authorization, transactional/session-fresh role changes, security events and role UI. Chain/funding/margin/futures/advanced-order execution remains unimplemented. See [RBAC runbook](./ADMIN_ROLE_PERMISSIONS.md) and [verification evidence](./V1_0_4_VERIFICATION.md).
