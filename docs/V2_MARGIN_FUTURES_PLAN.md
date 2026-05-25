# v2 Margin Futures Plan

This document describes long-term optional `v2.x` work only. It is not part of `v1.x`.

Nothing here is implemented in `v0.20`.

## Boundary

- `v2.x` only, not `v1.x`
- default disabled
- requires feature flags
- not part of the chain gateway

## Planned Areas

### Isolated Margin Simulation

- margin exposure isolated per position or per market context
- borrow and repayment remain simulation behaviors, not real lending integrations

### Long / Short Perpetual Simulation

- support long and short directional positions
- use simplified perpetual-style mechanics rather than a full real-exchange derivatives stack

### Liquidation Simulation

- define liquidation thresholds and forced-close logic
- keep liquidation behavior explicit and auditable

### Risk Dashboard

- show exposure, maintenance thresholds, unrealized PnL, and liquidation warnings
- prioritize admin and operator visibility before broad user rollout

## Simplified Model Vs Real Exchanges

- planned `v2.x` work is a simulation layer, not a full regulated derivatives platform
- funding, liquidation, mark pricing, insurance funds, and risk engines may be simplified compared with real exchanges
- product language should remain clear about that distinction

## Risks

- users may over-interpret simulated leverage features
- liquidation logic is easy to implement badly if risk rules are vague
- margin/futures complexity can distract from core spot and gateway stability

## Non-Goals

- no fiat margin products
- no regulated derivatives workflow
- no assumption that margin/futures must be enabled in every deployment

## Delivery Rule

Any future margin or futures capability must remain feature-flagged and default disabled until explicitly implemented, tested, and documented.
