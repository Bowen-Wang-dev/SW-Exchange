# Real Exchange Gap Analysis

SW Exchange `v0.x` is already a complete off-chain simulated exchange runtime. This document compares that runtime against a real centralized exchange module by module.

Status meanings:

- `Implemented`: live in the current runtime
- `Planned`: intended future work, not live
- `Optional`: future work that is intentionally non-default or product-optional
- `Not included`: outside current project boundary

| Module | Status | Current state | Gap / future direction |
| --- | --- | --- | --- |
| Account/auth | Implemented | Registration, JWT login, protected user/admin routes exist | `v1.0` plans stronger verification and sensitive-action security |
| User security | Planned | Email verification foundation exists, but TOTP 2FA and sensitive-action enforcement are not live yet | `v1.0` focuses on verification, TOTP, re-auth, and security logs |
| Wallet/accounting | Implemented | Internal off-chain wallets, balance locking, ledger entries, admin buckets | Real custody and reconciliation are future `v1.x` work |
| Deposits | Planned | Not implemented | Future optional chain-token deposit gateway only; no fiat |
| Withdrawals | Planned | Not implemented | Future optional chain-token withdrawal gateway only; no fiat |
| Asset management | Implemented | Admin can create assets, edit metadata, pause/resume | `v1.1` may add chain asset registry metadata |
| Market management | Implemented | Admin can create markets, pause/resume, review fees | Current spot-style scope is live |
| Matching engine | Implemented | Spot-style matching with price-time priority is live | Margin/futures matching is not part of `v0.x` |
| Order types | Implemented | `LIMIT` and `MARKET` are live | Advanced orders are planned and feature-flagged |
| Market data | Implemented | Order book, ticker, candles, summaries, recent trades are live | Push-based delivery and richer analytics remain future work |
| Trading terminal UI | Implemented | Dense exchange-style `/trade` surface is live | Mobile optimization and advanced tooling remain future work |
| Fees | Implemented | Market fee settings and fee-settlement ledger behavior are live | Withdrawal/gas fee handling is future `v1.x` work |
| Ledger/audit/reports | Implemented | User/admin ledger, audit logs, reports, exports are live | Chain reconciliation reports are future `v1.x` work |
| Admin operations | Implemented | Admin controls, confirmations, filters, and system wallet buckets are live | Granular admin permissions are planned |
| Risk controls | Implemented | User freeze/ban, asset pause, market pause, confirmations exist | Withdrawal risk review, emergency gateway pause, and security approvals are planned |
| Compliance/KYC/fiat | Not included | No built-in KYC or fiat module exists | Remains outside current public boundary |
| Deployment/operations | Implemented | Docker deployment/runtime and verification scripts are live | More production ops guidance may come later |
| Security/monitoring | Planned | Basic auth/admin controls exist, but no dedicated security subsystem | `v1.0` and later gateway phases add logs, permissions, and operational controls |
| Margin/futures | Optional | Not implemented | `v2.x` may add simulation-only modules, default disabled |

## Summary

- `v0.x` is a finished off-chain simulated exchange runtime, not an incomplete exchange shell.
- `v1.x` is planned to focus on security hardening plus optional chain token gateway capabilities.
- `v2.x` is planned only for optional margin/futures simulation and must remain default disabled.
- This document does not imply that any future feature is already live.
