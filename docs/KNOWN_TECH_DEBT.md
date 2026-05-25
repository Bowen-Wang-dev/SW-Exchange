# Known Tech Debt

## Runtime / Sync

- Item: No Redis, message bus, or real-time event backbone
  - Status: temporary
  - Why accepted: current scope is a local/dev simulated exchange
  - Future fix: add event transport and subscription layer if real-time scale matters

- Item: Web UI relies on polling and manual refresh patterns
  - Status: intentional
  - Why accepted: simpler than introducing live streaming infra in v0.x
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

- Item: Local Docker/Postgres assumptions remain strong
  - Status: intentional
  - Why accepted: project is optimized for Codespaces/local development
  - Future fix: add documented hosted-dev / CI alternatives

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
  - Why accepted: contract surface is still moving in v0.x
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
  - Why accepted: assets are internal simulation listings
  - Future fix: optional external metadata sync if chain assets ever arrive

## Local Reference Material

- Item: Demo/reference sample files are local/untracked workflow artifacts
  - Status: intentional
  - Why accepted: useful for design reference without becoming runtime dependency
  - Future fix: formalize curated references if the set grows
