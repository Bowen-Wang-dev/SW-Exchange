# Chain Event Indexing

This document plans future chain monitoring and indexing. Nothing here is implemented in `v0.20`.

## Detection Options

- RPC polling
- third-party indexer
- self-hosted indexer

Early implementation should prefer detect-only behavior before automated crediting.

## Detect-Only First

- First shipping goal should be event detection with persistence and review visibility
- Detection should not imply auto-crediting
- This keeps chain-observed data visible before balance mutation is introduced

## Event Identity And Uniqueness

- tx hash uniqueness is necessary but not always sufficient
- log or event uniqueness should include chain-specific event index data
- idempotency keys should be stable across retries and restarts

## Matching Rules

- detect supported token transfers only
- match contract address against configured registry records
- match destination address against assigned or monitored addresses
- reject unsupported tokens or unknown destination mappings cleanly

## Confirmation Depth

- hold events until asset-specific confirmation depth is met
- keep pre-confirmation and post-confirmation states distinct

## Reorg Handling Concept

- re-check previously seen events across later blocks
- preserve the ability to mark an event `REORGED`
- never assume first observation is final

## Retry Behavior

- detection retries must be idempotent
- crediting retries must reuse the same idempotency keys
- monitoring failures should surface health alerts rather than silently skipping work

## Monitor Health Checks

- last successful poll height or cursor
- provider availability
- delay from chain tip
- failed request count
- retry backlog

## Reconciliation Reports

- detected vs credited deposits
- requested vs completed withdrawals
- unknown token events
- duplicate events
- stale confirming items

## What To Log

- chain/network identifier
- monitored contract address
- destination address reference
- tx hash
- log/event index
- block height
- confirmation state
- idempotency reference
- credit or rejection outcome

## What Not To Log

- private keys
- raw secret-manager payloads
- signer credentials
- sensitive internal secret material

## Boundary Reminder

- Planned only
- No chain monitoring is live in `v0.20`
