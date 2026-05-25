# Current Limitations

These items are intentionally out of scope in the current system state. Do not document or implement them as if they are already live.

## Funding / Chain

- Deposit is not implemented.
- Withdraw is not implemented.
- Blockchain integration is not implemented.
- Chain listeners and deposit addresses are not implemented.
- Hot wallet signing is not implemented.
- Real fiat redemption is not implemented.

## Security / Account Hardening

- Email verification is not implemented.
- TOTP 2FA is not implemented.
- Sensitive-action re-auth is not implemented.
- Granular admin role permissions are not implemented.
- Phone or SMS verification is not implemented.

## Trading Scope

- Leverage, margin, futures, and contracts are not implemented.
- Stop-loss and take-profit are not implemented.
- Post-only is not implemented.
- User-facing FOK is not implemented.
- Advanced execution routing is not implemented.

## Compliance / Real-Money Scope

- Built-in KYC is not implemented.
- Fiat deposits and fiat withdrawals are not implemented.
- Cash payout or fiat conversion is not implemented.
- Regulated financial exchange workflow is not implemented.
- Assets and balances remain internal simulation records.
- `v0.x` remains an off-chain internal-accounting exchange runtime only.

## Market Data / Charting

- TradingView-level advanced charting is not implemented.
- Technical indicators are not implemented.
- Depth chart is not implemented.
- Candle storage / background aggregation is not implemented.

## UI Scope

- Mobile-specific trading UI is not optimized.
- Large UI redesign work is out of scope unless explicitly requested.

## Current Operational Boundaries

- User-facing transfers currently support `SWC` and `SWL` only.
- Asset icons are URL-based or fallback-based; file upload is not implemented.
- Future `v1.x` and `v2.x` planning docs do not mean those capabilities are live.
- No placeholder or planning-only material should be treated as runtime capability.
