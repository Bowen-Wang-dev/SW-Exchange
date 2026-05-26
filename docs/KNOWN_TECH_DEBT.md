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

- Item: No email verification, TOTP 2FA enforcement, or sensitive-action re-auth yet
  - Status: intentional
  - Why accepted: `v0.x` has remained off-chain and non-custodial at the chain layer
  - Future fix: build on the `v1.0.1 Security Logs + Sensitive Action Model` foundation plus later `v1.x` security milestones before any chain money movement

- Item: No granular admin role-permission model
  - Status: temporary
  - Why accepted: single-admin runtime is sufficient for current simulated deployment scope
  - Future fix: introduce role-scoped admin permissions and security logs before enabling withdrawal operations

- Item: No chain reconciliation, deposit monitoring, or withdrawal idempotency subsystem
  - Status: intentional
  - Why accepted: deposit, withdraw, and blockchain support are not implemented in `v0.x`
  - Future fix: implement the planned `v1.x` chain gateway phases instead of bolting chain logic into the current runtime

## Local Reference Material

- Item: Demo/reference sample files are local/untracked workflow artifacts
  - Status: intentional
  - Why accepted: useful for design reference without becoming runtime dependency
  - Future fix: formalize curated references if the set grows; keep `sample/` local-only until then
