# Hot Wallet Model

This document plans the future chain custody model. Nothing here is implemented in `v0.20`.

## Current v0.x Wallet Buckets

- `MAIN`
- `FEE`
- `TREASURY`
- `AIRDROP`
- `HOT`

In current `v0.x`, `HOT` is only a placeholder bucket with no live chain behavior.

## Future HOT Wallet Meaning

- `HOT` becomes the operator-controlled chain wallet used for early gateway operations
- Internal admin `HOT` accounting remains separate from actual chain secret storage concerns
- The chain wallet concept should not be confused with the current internal wallet bucket alone

## Early v1.x Scope

- Hot wallet only in early `v1.x`
- Cold wallet is documented as a future optional concept, not an early implementation requirement

## Deposit Address Model

- Per-user EVM/BSC-style deposit address assignment is one possible early model
- Address ownership and mapping must be explicit and auditable
- Address generation policy must be defined before runtime use

## Address Generation And Private Key Risk

- Address generation introduces direct private-key or signer risk
- Key material must never be stored in the repo
- Secrets must never be logged
- Operator-owned secret manager or external signer support remains a preferred future option

## Collection / Sweeping Concept

- User deposit addresses may need sweeping into a central operational wallet
- Sweeping should be an explicit tracked operation, not an implicit balance assumption
- Gas availability must be considered for each sweep

## Gas Requirement For Sweeping

- Token balances may be stranded without native gas funding
- Sweep planning must distinguish token amount, gas amount, and operator gas reserve

## Withdrawal Source Model

- Early withdrawals may be broadcast from a shared hot wallet
- Internal accounting should still identify the user withdrawal request separately from the source wallet used on chain

## Withdrawal Fee Vs Gas Cost

- Platform withdrawal fee is an operator policy value
- Gas cost is a chain execution cost
- They must be tracked separately in planning, accounting, and operator reporting

## Private Key Handling Principles

- never store private keys in the repo
- never log secrets
- minimize direct signer exposure
- prefer managed secrets or external signers where practical
- keep access tightly permissioned and auditable

## Cold Wallet Concept

- Cold-wallet or multi-tier custody can be documented later as an optional operational upgrade
- It is not required for early planning completion and is not implemented early

## Operational Risks

- key compromise
- signer misuse
- wrong-address configuration
- insufficient gas
- duplicate broadcast attempts
- incomplete reconciliation
- unclear operator approval responsibilities

## Boundary Reminder

- Planned only
- No live custody implementation yet
