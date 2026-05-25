# SW Exchange Roadmap

SW Exchange is being built in focused milestones so the simulated exchange stays narrow, testable, and easy to extend.

## Milestone Status

Current completed milestone: `v1.0.0 Feature Flags Foundation`

Next milestone: `v1.0.1 Security Logs + Sensitive Action Model`

## Current State

- `v0.x` is a complete off-chain simulated exchange runtime for custom assets and custom markets.
- Spot-style trading, internal wallets/transfers, market data, admin operations, and Docker deployment are live.
- Deposit, withdraw, blockchain, 2FA, email verification, margin, and futures are not live.

## v1.0.0 Feature Flags Foundation - Completed

- Added a database-backed feature flag model for optional and high-risk future modules
- Added public and admin read endpoints for current feature flag state
- Added backend fail-closed flag lookup and enforcement helper pattern
- Added admin feature-flag visibility UI
- Kept deposits, withdrawals, chain gateway behavior, 2FA, email verification, margin, futures, shorting, liquidation, and advanced orders unimplemented
- Kept trading-core, fee logic, wallet rules, and transfer rules unchanged

## v0.20 Exchange Boundary + v1/v2 Planning Docs - Completed

- Defined the public boundary of SW Exchange as a simulated exchange runtime
- Clarified what is in scope, out of scope, and operator-owned responsibility
- Added gap analysis, feature-flag planning, auth/security planning, chain gateway planning, custody planning, indexing planning, and `v1.x` sequencing docs
- Added `v2.x` optional margin/futures simulation planning docs
- No API behavior, schema, trading-core behavior, wallet rules, transfer rules, or deployment runtime behavior changed

## Planned v1.x Sequence

1. `v1.0.1 Security Logs + Sensitive Action Model`
2. `v1.1 Chain Asset Registry`
3. `v1.2 User Deposit Address Model`
4. `v1.3 Deposit Monitor Detect-only`
5. `v1.4 Deposit Credit Flow`
6. `v1.5 Withdrawal Request`
7. `v1.6 Withdrawal Approval + Broadcast`
8. `v1.7 Gas / Withdrawal Fee Management`
9. `v1.8 Chain Reconciliation / Audit`
10. `v1.9 Chain Gateway Stabilization`

## Planned v2.x Direction

- Optional margin trading simulation
- Optional perpetual futures simulation
- Optional long/short support
- Optional liquidation simulation
- Default disabled behind feature flags
- Not part of the `v1.x` chain gateway scope

## Reference Docs

- [EXCHANGE_BOUNDARY.md](./EXCHANGE_BOUNDARY.md)
- [REAL_EXCHANGE_GAP_ANALYSIS.md](./REAL_EXCHANGE_GAP_ANALYSIS.md)
- [FEATURE_FLAGS_PLAN.md](./FEATURE_FLAGS_PLAN.md)
- [V1_IMPLEMENTATION_SEQUENCE.md](./V1_IMPLEMENTATION_SEQUENCE.md)
- [V2_MARGIN_FUTURES_PLAN.md](./V2_MARGIN_FUTURES_PLAN.md)
