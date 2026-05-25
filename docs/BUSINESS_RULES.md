# Business Rules

This document is the current v0.x business-law reference for trading, wallets, fees, transfers, and admin controls.

## Matching Rules

- Matching is market-specific. Orders only match inside the same `marketId`.
- Price-time priority applies.
- BUY takers consume lowest eligible asks first.
- SELL takers consume highest eligible bids first.
- When prices cross, execution uses the resting maker order price.
- Partial fills are allowed for limit and market orders.
- Self-trade prevention is active: matching skips resting orders from the same user.
- Only `ACTIVE` users are eligible on the matching side; non-active users do not provide live matching liquidity.

## Limit Orders

- Limit BUY locks quote asset in the user's `MAIN` wallet.
- Limit SELL locks base asset in the user's `MAIN` wallet.
- Limit orders may rest on the book as `OPEN` or `PARTIAL_FILLED`.
- Cancellation unlocks the remaining locked amount.
- A better-price BUY fill can produce an `ORDER_UNLOCK` refund for excess locked quote.

## Market Orders

- Market orders behave like IOC-style taker orders.
- Market BUY uses quote spend input via `quoteAmount` or `spendAmount`.
- Market SELL uses base amount input via `amount`.
- Market orders never rest on the order book.
- Market orders cannot be manually cancelled.
- If no fills happen, the order is rejected and the API returns `NO_LIQUIDITY`.
- If partially filled, the executed portion settles and the remainder is auto-cancelled.
- Partial market completion uses status `PARTIAL_FILLED_CANCELLED`.

## Fees

- Fee rates are stored as integer basis points.
- Default buyer fee: `10` bps (`0.10%`) unless admin changes it.
- Default seller fee: `10` bps (`0.10%`) unless admin changes it.
- Buyer fee asset: base asset received.
- Seller fee asset: quote asset received.
- Fee settlement credits the admin `FEE` wallet bucket.
- Fee math uses minimal-unit bigint arithmetic with floor rounding.

## Transfers

- Normal user transfers are `MAIN` to `MAIN` only.
- Normal transfer source is always the logged-in user's own `MAIN` wallet.
- Normal transfer recipients receive into `MAIN`.
- Users cannot transfer directly to admin system buckets.
- Admin cannot use a normal transfer to move funds between other users.
- Current user-facing transfer flow supports `SWC` and `SWL` only.

## Admin Bucket Transfers

- Admin bucket transfers are admin-only internal moves between the admin user's own wallets.
- Source and destination wallet types must differ.
- Bucket transfers move `availableBalance` only.
- Locked balances are not transferable.
- Current asset must be active.
- Bucket transfers never move funds directly to a normal user.

## System Wallet Restrictions

- `FEE`, `TREASURY`, `AIRDROP`, and `HOT` are admin bucket wallets, not normal user wallets.
- Normal users do not own system buckets.
- `HOT` is a placeholder only; it has no live chain behavior.

## Wallet Buckets

- `MAIN`: ordinary internal wallet
- `FEE`: active platform fee wallet
- `TREASURY`: placeholder treasury bucket
- `AIRDROP`: placeholder airdrop bucket
- `HOT`: placeholder future chain hot wallet

## User Status Rules

- `ACTIVE`: can log in and use normal trading / transfer flows
- `FROZEN`: can log in and view, but cannot transfer, place orders, cancel orders, or trade through matching
- `BANNED`: cannot log in; authenticated requests are rejected

## Asset / Market Pause Rules

- Paused assets remain visible in wallet and history views.
- Paused assets block transfers, airdrops, and new orders involving that asset.
- Paused markets block new orders and new matching.
- Paused markets remain viewable in order book, trade history, and market views.
- Active users may still cancel existing open limit orders while a market is paused.

## Airdrop Rules

- Admin airdrop targets must be `ACTIVE`.
- Airdroped asset must be active.
- Airdrop credits the target user's `MAIN` wallet.
- Current v0.x airdrop remains unlimited.
- Current airdrop does not consume the admin `AIRDROP` wallet bucket.
- Airdrop writes both ledger and admin audit records.
