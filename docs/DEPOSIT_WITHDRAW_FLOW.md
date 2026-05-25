# Deposit Withdraw Flow

This document plans future chain deposit and withdrawal status flows.

Nothing here is implemented in `v0.20`. No fiat behavior is included.

## Deposit Statuses

- `DETECTED`
- `CONFIRMING`
- `READY_TO_CREDIT`
- `CREDITED`
- `REJECTED`
- `DUPLICATE`
- `REORGED`
- `UNSUPPORTED_TOKEN`

## Withdraw Statuses

- `REQUESTED`
- `PENDING_REVIEW`
- `APPROVED`
- `SIGNING`
- `BROADCASTED`
- `CONFIRMING`
- `COMPLETED`
- `REJECTED`
- `FAILED`
- `CANCELLED`

## Deposit Flow

1. Chain monitor detects a supported token transfer to a known deposit address -> `DETECTED`
2. Confirmation tracker waits for required depth -> `CONFIRMING`
3. After minimum confirmations and validation checks pass -> `READY_TO_CREDIT`
4. Internal credit transaction writes wallet and ledger updates -> `CREDITED`

## Confirmation Flow

- Confirmation depth must be asset-specific
- Re-check contract address, token identity, amount, and recipient mapping before credit
- If a chain reorg invalidates the event before credit, move to `REORGED`

## Crediting Flow

- Credit only once per stable idempotency key
- Increase internal user `MAIN.available`
- Write deposit ledger entry
- Write audit trail for detection, validation, and credit outcome

## Duplicate / Unsupported Handling

- Duplicate detection should mark repeated observations as `DUPLICATE`
- Unsupported token transfers to watched addresses should be tracked as `UNSUPPORTED_TOKEN`
- Rejected events should preserve reason codes for operator review

## Withdrawal Request Flow

1. User submits withdrawal request -> `REQUESTED`
2. Internal balance is frozen or reserved immediately
3. Policy routes request to `PENDING_REVIEW` or directly to `APPROVED`

## Balance Freeze

- Freeze the requested amount plus any platform withdrawal fee policy as needed
- Do not reduce user available balance twice across retries
- Cancellation or rejection must release frozen balance safely

## Admin Review / Auto-Release

- Manual review should be the default early `v1.x` path
- Auto-release, if ever allowed, must still respect backend feature flags and policy checks
- Approval action should be audited with actor identity and reason

## Chain Broadcast

1. Approved request enters `SIGNING`
2. Signing subsystem or external signer prepares transaction
3. Successful submission moves to `BROADCASTED`
4. Chain confirmations move it to `CONFIRMING`
5. Final confirmed completion moves it to `COMPLETED`

## Failure Handling

- Broadcast or signing failures move to `FAILED`
- Admin rejection moves to `REJECTED`
- User or operator cancellation before broadcast may move to `CANCELLED`
- Failed or cancelled withdrawals must reconcile frozen balance release rules

## Ledger Updates

- Deposit credit writes deposit ledger entries
- Withdrawal request writes reservation/freeze ledger entries
- Withdrawal completion writes settlement ledger entries
- Reversal or cancellation paths write explicit unlock/release entries

## Audit Logs

- Detect, validate, credit, reject, approve, sign, broadcast, confirm, fail, cancel
- Keep structured actor, asset, amount, address reference, and idempotency reference data
- Never log secrets or raw private key material

## Boundary Reminder

- No fiat flow
- Planned only
- Not implemented in `v0.20`
