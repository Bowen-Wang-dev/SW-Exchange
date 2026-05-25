# v1 Implementation Sequence

This document defines the planned phased `v1.x` roadmap. Each phase remains planned-only until implemented.

## v1.0 Auth Security + Feature Flags

- Goal: create a security baseline before any chain money movement
- Scope: email verification, TOTP 2FA planning implementation, sensitive re-auth, admin role permissions, security logs, backend-enforced feature flags
- Non-goals: no chain deposit/withdraw execution yet
- Required tests: auth regression tests, 2FA flow tests, permission tests, flag enforcement tests, rate-limit tests
- Rollback / disable plan: disable the relevant security or optional feature flags; keep chain gateway off
- User-visible state: security settings pages and clearer account-verification state

## v1.1 Chain Asset Registry

- Goal: link internal assets to optional chain metadata safely
- Scope: registry model, admin controls, validation, per-asset deposit/withdraw flags
- Non-goals: no deposit detection or withdrawal execution yet
- Required tests: registry validation tests, admin auth tests, disabled-flag enforcement tests
- Rollback / disable plan: disable `enableChainGateway` and deposit/withdraw flags, leave internal assets untouched
- User-visible state: at most limited metadata visibility; no live funding actions

## v1.2 User Deposit Address Model

- Goal: create address assignment and ownership tracking
- Scope: deposit address issuance model, address history, admin visibility, operational status fields
- Non-goals: no crediting yet
- Required tests: address uniqueness, auth/security tests, admin audit tests
- Rollback / disable plan: stop new address issuance and keep existing assignments inactive
- User-visible state: deposit addresses may appear only if deposits remain otherwise disabled or clearly not yet creditable

## v1.3 Deposit Monitor Detect-only

- Goal: detect supported transfers without mutating balances
- Scope: chain polling/indexing, detection persistence, confirmation tracking, review surfaces
- Non-goals: no auto-crediting yet
- Required tests: monitor idempotency, duplicate detection, reorg-handling tests, health-check tests
- Rollback / disable plan: pause monitor jobs and preserve observed records for review
- User-visible state: deposit status visibility may show detect-only or pending states without credited balances

## v1.4 Deposit Credit Flow

- Goal: credit confirmed supported deposits into internal balances
- Scope: deposit status transitions, ledger writes, audit logs, idempotent credit pipeline
- Non-goals: no withdrawal support yet
- Required tests: credit idempotency, ledger/audit integrity, unsupported-token handling, paused-asset tests
- Rollback / disable plan: disable `enableDeposits`; keep already credited balances intact and stop new credits
- User-visible state: users can see confirmed deposit history and credited internal balances

## v1.5 Withdrawal Request

- Goal: allow users to request withdrawals without broadcasting yet
- Scope: request validation, balance freeze/reserve, review queue states, security prerequisite checks
- Non-goals: no signing or broadcast yet
- Required tests: freeze/unfreeze tests, auth security tests, request validation tests, review-queue tests
- Rollback / disable plan: disable `enableWithdrawals` and unblock pending requests according to policy
- User-visible state: withdrawal request form and pending-review history, if enabled

## v1.6 Withdrawal Approval + Broadcast

- Goal: execute approved withdrawals on chain
- Scope: approval flow, signing step, broadcast step, state machine, audit logs
- Non-goals: no sophisticated fee optimization or sweeping automation yet
- Required tests: approval permission tests, signer integration tests, broadcast idempotency tests, failure recovery tests
- Rollback / disable plan: disable `enableWithdrawals` or `enableChainGateway`; stop new broadcasts and keep review queue available
- User-visible state: withdrawals move from request to broadcast and confirmation states

## v1.7 Gas / Withdrawal Fee Management

- Goal: manage network gas needs and operator withdrawal fee policy separately
- Scope: gas reserve planning, platform withdrawal fee logic, admin controls, reporting clarity
- Non-goals: no margin/futures work
- Required tests: fee-calculation tests, gas-policy tests, admin-control tests
- Rollback / disable plan: revert to manual operational fee settings or pause withdrawals
- User-visible state: clearer withdrawal fee presentation and status messaging

## v1.8 Chain Reconciliation / Audit

- Goal: compare internal records with chain-observed outcomes
- Scope: reconciliation jobs, mismatch reporting, stale-item review, operator audit support
- Non-goals: no new trading behavior
- Required tests: reconciliation report tests, mismatch detection tests, replay/idempotency tests
- Rollback / disable plan: pause reconciliation jobs while preserving data for manual review
- User-visible state: mostly admin-facing audit and reconciliation surfaces

## v1.9 Chain Gateway Stabilization

- Goal: harden the optional gateway for sustained operation
- Scope: operational cleanup, emergency controls, alerting, documentation, review of defaults
- Non-goals: no margin/futures rollout
- Required tests: end-to-end funding tests, pause/resume tests, regression tests, ops runbook checks
- Rollback / disable plan: feature flags remain the emergency off-switches
- User-visible state: more stable deposit/withdraw experience where enabled
