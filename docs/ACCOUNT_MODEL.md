# SW Exchange Account Model

Current completed milestone: `v0.13 Admin Asset / Market Creation`

## Account Status

User statuses are:

- `ACTIVE`: normal account behavior
- `FROZEN`: can login and view dashboard, wallets, ledger, orders, and trades, but cannot transfer, place orders, cancel orders, or trade through matching
- `BANNED`: cannot login; existing banned sessions are rejected by authenticated API requests

Transfer recipients and admin airdrop targets must be `ACTIVE`. Frozen users are blocked from receiving transfers and airdrops for the safer/simple v0.x rule.

## Wallet Buckets

Normal users have `MAIN` wallets only.

The admin user has:

- `MAIN`: the admin user's ordinary internal wallet
- `FEE`: active platform trading fee wallet
- `TREASURY`: placeholder platform treasury wallet
- `AIRDROP`: placeholder future airdrop source wallet
- `HOT`: placeholder future chain hot wallet

Fees go to the admin `FEE` wallet. Buyer fees are collected in the traded base asset; seller fees are collected in the quote asset.

Airdrops are still unlimited in current v0.x and do not deduct from the `AIRDROP` wallet.

v0.13 adds admin-created asset and market listing without changing the wallet bucket model or transfer rules.
New assets eagerly create zero-balance `MAIN` wallets for existing users and zero-balance admin `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, and `HOT` wallets idempotently.

## Asset Metadata

Assets may have optional display metadata:

- display name
- icon URL
- icon source
- sort order
- description

Listed assets such as `SWC`, `SWL`, and `SWD` remain internal simulation assets. Admins can manually add more virtual assets and set icon URLs directly. Missing icons render as clean symbol avatars. Metadata does not affect balances, transfer eligibility, matching, fee calculation, or status rules.

## Portfolio Valuation

Portfolio valuation is informational only and does not move wallet balances.

- `SWC` is valued at `1 SWC`
- Non-SWC assets are valued from their latest real `*/SWC` last price when available
- Available and locked balances are both included in each asset total
- If no market price exists for a non-SWC asset, that asset valuation remains pending and total equity excludes it
- No fake prices are generated

## Transfers

Normal internal transfers are free and always move `MAIN` to `MAIN`.

Allowed normal transfers:

- normal user `MAIN` to normal user `MAIN`
- normal user `MAIN` to admin `MAIN`
- admin `MAIN` to normal user `MAIN`

The logged-in user can only transfer from their own `MAIN` wallet. Admin cannot use normal transfer to move funds from one user to another, and users cannot transfer to admin system wallet buckets.

Admin bucket transfers are free and only move funds between the admin user's own wallet buckets for the same asset. They never move funds directly to normal users.

To move system funds to a user:

1. Admin bucket transfer: `FEE`, `TREASURY`, `AIRDROP`, or `HOT` to admin `MAIN`
2. Normal transfer: admin `MAIN` to user `MAIN`

## Asset And Market Status

Assets are either active or paused.

- Paused assets remain visible in wallets and balance views
- Paused assets cannot be transferred or airdropped
- Paused assets cannot be used for new orders

Markets such as `SWL/SWC`, `SWD/SWC`, and later admin-created `BASE/QUOTE` pairs are either `ACTIVE` or `PAUSED`.

- Paused markets block new orders and matching
- Order book and trade history remain viewable
- Active users may still cancel existing open orders while the market is paused so locked funds can unlock

## Future v1.x Blockchain Plan

No blockchain features are implemented now.

Future plans may add:

- independent chain deposit addresses for every user/admin account
- deposits that credit internal `MAIN` wallets after chain confirmation
- withdrawals that debit or freeze `MAIN` wallets and may broadcast from a shared `HOT` wallet
- no deposit platform fee in the current plan
- possible network or platform fees for withdrawals later

Internal transfers remain free. The `HOT` wallet bucket is only a placeholder in v0.x.
