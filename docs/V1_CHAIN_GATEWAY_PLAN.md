# v1 Chain Gateway Plan

This document plans an optional future blockchain token gateway for `v1.x`.

It is planned only and not implemented in `v0.20`.

## v1.x Goals

- Add optional chain-linked asset metadata for listed assets
- Support token deposits into internal user balances after confirmation
- Support token withdrawal requests with review and broadcast controls
- Add operational controls for hot wallet usage, reconciliation, and emergency pause
- Keep the current off-chain trading and accounting model as the internal ledger of record

## Non-Goals

- No fiat deposits
- No fiat withdrawals
- No cash redemption
- No built-in KYC workflow
- No promise of multi-chain support in the first implementation
- No assumption that every listed asset must be chain-backed

## High-Level Architecture

1. Asset listed in the current internal asset model
2. Optional chain asset registry record linked to that asset
3. User deposit address assignment model
4. Chain monitoring subsystem detects supported transfers
5. Deposit pipeline confirms and credits internal `MAIN` wallet balances
6. Withdrawal request pipeline freezes internal balance, routes review, signs, broadcasts, and reconciles
7. Reconciliation and audit processes compare chain-observed state with internal ledger state

## Planned Components

### Chain Asset Registry

- Stores chain-specific metadata and operational flags
- Separates internal asset identity from chain transport metadata

### User Deposit Address Model

- Assign address records per supported chain asset or per chain/address pool policy
- Preserve address ownership history and admin visibility

### Deposit Monitor

- Detect supported transfers using polling or indexers
- Confirm by contract address, token metadata, and destination address
- Remain idempotent across retries and reorgs

### Deposit Crediting

- Hold deposits until required confirmation depth is met
- Prevent duplicate crediting by stable idempotency keys
- Write ledger and audit records on credit

### Withdrawal Request

- Freeze or reserve internal balance before any chain action
- Require user/account security prerequisites before request acceptance

### Withdrawal Approval / Broadcast

- Route requests through manual review or policy-controlled release
- Separate request, approval, signing, and broadcast states
- Keep broadcast idempotent and auditable

### Gas / Withdrawal Fee Management

- Distinguish network gas costs from platform withdrawal fees
- Track operator-controlled fee policy separately from asset transfer amount

### Hot Wallet Operations

- Early `v1.x` assumes hot-wallet-based execution only
- Secret management and external signer options remain future operational upgrades

### Reconciliation / Audit

- Compare deposits detected vs credited
- Compare withdrawals requested vs broadcasted vs completed
- Surface mismatches, retries, paused items, and manual-review exceptions

### Emergency Pause / Disable

- Allow deposits, withdrawals, or the full chain gateway to be disabled independently
- Keep backend enforcement as the source of truth

## Risks And Assumptions

- Tokens may have value even if the project started as a simulation runtime
- Address generation and private-key handling are high-risk concerns
- RPC/indexer reliability can affect detection and reconciliation
- Reorgs, duplicate events, and retry behavior must be treated as normal operating conditions
- A simple chain gateway must still be built with auditability and operational controls

## Boundary Reminder

- Planned only
- Not implemented yet
- No fiat support
