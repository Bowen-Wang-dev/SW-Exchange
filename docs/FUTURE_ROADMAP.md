# SW Exchange Future Roadmap

This plan documents intended future work after `v0.20 Exchange Boundary + v1/v2 Planning Docs`. These items are not live until their milestone is implemented.

## Completed Baseline

- `v0.19 One-Command Deploy / Docker Production Runtime` is completed.
- `v0.20 Exchange Boundary + v1/v2 Planning Docs` is completed.
- `v0.x` is currently a complete off-chain simulated exchange runtime for custom assets and custom markets.
- Deposit, withdraw, blockchain, 2FA, email verification, margin, and futures features are not live.

## v1.x Focus

- `v1.x` is planned to focus on auth/security hardening and optional chain token gateway capabilities.
- Planned starting sequence:
  - `v1.0 Auth Security + Feature Flags`
  - `v1.1 Chain Asset Registry`
  - `v1.2 User Deposit Address Model`
  - `v1.3 Deposit Monitor Detect-only`
  - `v1.4 Deposit Credit Flow`
  - `v1.5 Withdrawal Request`
  - `v1.6 Withdrawal Approval + Broadcast`
  - `v1.7 Gas / Withdrawal Fee Management`
  - `v1.8 Chain Reconciliation / Audit`
  - `v1.9 Chain Gateway Stabilization`

## v1.x Boundaries

- Optional chain token gateway only
- No fiat deposits
- No fiat withdrawals
- No cash redemption
- No built-in KYC workflow
- No regulated financial exchange workflow

## v2.x Direction

- `v2.x` is planned-only and remains outside the `v1.x` chain gateway scope.
- Optional future areas:
  - isolated margin simulation
  - long/short perpetual simulation
  - liquidation simulation
  - risk dashboard
- `v2.x` modules must be feature-flagged and default disabled.

## Reference Planning Docs

- [EXCHANGE_BOUNDARY.md](./EXCHANGE_BOUNDARY.md)
- [REAL_EXCHANGE_GAP_ANALYSIS.md](./REAL_EXCHANGE_GAP_ANALYSIS.md)
- [FEATURE_FLAGS_PLAN.md](./FEATURE_FLAGS_PLAN.md)
- [V1_IMPLEMENTATION_SEQUENCE.md](./V1_IMPLEMENTATION_SEQUENCE.md)
- [V2_MARGIN_FUTURES_PLAN.md](./V2_MARGIN_FUTURES_PLAN.md)
