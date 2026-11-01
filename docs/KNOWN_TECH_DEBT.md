# Known Tech Debt

## Runtime / Sync

- Item: No Redis, message bus, or real-time event backbone
  - Status: temporary
  - Why accepted: current scope is an off-chain simulated exchange runtime with polling-friendly scale
  - Future fix: add event transport and subscription layer if real-time scale matters

- Item: Web UI relies on polling and manual refresh patterns
  - Status: intentional
  - Why accepted: simpler than introducing live streaming infra in `v0.x`
  - Future fix: move order book / trades / balances to push-based updates

## Testing / Dev Workflow

- Item: Smoke assumes local API and web are already running for route checks
  - Status: temporary
  - Why accepted: keeps smoke simple and fast in current local workflow
  - Future fix: wrap smoke with automatic stack start/stop or ephemeral test harness

- Item: Smoke is rerunnable against reused local DBs, but still depends on local infra health
  - Status: intentional
  - Why accepted: idempotent scenario isolation solved the biggest day-to-day pain
  - Future fix: add isolated CI database lifecycle and service orchestration

- Item: Docker Compose production runtime is single-host demo/VPS oriented, not clustered or orchestrated
  - Status: intentional
  - Why accepted: current goal is one-command local/VPS deployment simplicity for an off-chain demo runtime
  - Future fix: add reverse proxy, secret management, and orchestrated deployment guidance if hosted production scope grows

## Market Data

- Item: No production-grade candle aggregation table
  - Status: temporary
  - Why accepted: current trade volume is small and candle queries stay simple
  - Future fix: materialized candle storage or background aggregation

- Item: Candles are computed from settled trades on demand
  - Status: intentional
  - Why accepted: keeps schema and write path small
  - Future fix: pre-aggregate by interval and market

## API / Docs

- Item: No full OpenAPI spec
  - Status: temporary
  - Why accepted: contract surface is still moving in `v0.x`
  - Future fix: generate and publish machine-readable API spec

- Item: Some UI/API state is refreshed manually after mutations
  - Status: temporary
  - Why accepted: explicit reloads are easy to reason about
  - Future fix: normalized client cache or event-driven invalidation

## Assets / Metadata

- Item: No icon file upload flow
  - Status: intentional
  - Why accepted: URL-based metadata is enough for current internal listings
  - Future fix: add validated upload/storage pipeline

- Item: No external token metadata lookup
  - Status: intentional
  - Why accepted: assets are internal simulation listings in `v0.x`
  - Future fix: optional external metadata sync if chain assets ever arrive

## Security / Operations

- Item: Pool-safe authentication and consistent administrative data/authority boundaries
  - Status: remediated in the second v1.0.4 review
  - Current: durable role-proof counters finish before user-row locking; setup/enable flag reads reuse the transaction. Ten-request/ten-connection real PostgreSQL regressions guard against pool starvation. Fee-settings GET/PATCH/POST require wallets.read plus the relevant fee scopes. Administrator status mutations enforce the same live effective target ceiling as role replacement, including legacy fallback and queued role promotions.
  - Limitations: production pool capacity/timeouts are unchanged; this removes the dependency cycle rather than claiming a general load benchmark. Broader mandatory MFA, trusted-proxy deployment and platform fee-principal separation remain separate hardening tasks. See V1_0_4_REMEDIATION.md for exact verification.

- Item: General sensitive-action enforcement and mandatory admin MFA remain incomplete
  - Status: temporary
  - Current: optional TOTP and fresh password/factor reauthentication for 2FA and admin role management are implemented; financial/configuration mutations still use permission checks and confirmation without general step-up policy.
  - Future fix: explicit admin MFA and per-action verification policies before custody/funding work.

- Item: Administrative roles are a versioned fixed registry; database owners remain trusted
  - Status: intentional
  - Current: viewer/operator/super_admin and explicit permissions are implemented. No custom role editing, multi-party approvals or HTTP emergency recovery.
  - Future fix: reviewed registry migrations and audited maintenance recovery; consider dual approval for future high-impact operations.
  - Rollout caution: disabling enableAdminRolePermissions permits orphaned/unassigned ADMIN operational access; assigned roles stay constrained. See ADMIN_ROLE_PERMISSIONS.md.

- Item: Platform fee principal remains coupled to a configured human ADMIN identity
  - Status: protected limitation
  - Current: role mutation rejects removal of ADMIN_EMAIL's ADMIN identity with 409 under the shared lock. Status suspension/ban preserves fee lookup while revoking sessions. Fee ownership and percentages do not change.
  - Future fix: reviewed platform/service-principal separation with an explicit wallet/ledger ownership plan; another super-admin is not an automatic fee recipient.

- Item: Trusted reverse-proxy deployment remains future work
  - Status: intentional
  - Current: all audit consumers use socket.remoteAddress only; arbitrary forwarding headers are ignored. Behind an unconfigured shared proxy, audit IPs identify that proxy.
  - Future fix: explicit trusted-hop configuration plus deployment tests before accepting forwarded client identity; never use audit source IP as authorization evidence.

- Item: No chain reconciliation, deposit monitoring, or withdrawal idempotency subsystem
  - Status: intentional
  - Why accepted: deposit, withdraw, and blockchain support are not implemented in `v0.x`
  - Future fix: implement the planned `v1.x` chain gateway phases instead of bolting chain logic into the current runtime

## Local Reference Material

- Item: Demo/reference sample files are local/untracked workflow artifacts
  - Status: intentional
  - Why accepted: useful for design reference without becoming runtime dependency
  - Future fix: formalize curated references if the set grows; keep `sample/` local-only until then
