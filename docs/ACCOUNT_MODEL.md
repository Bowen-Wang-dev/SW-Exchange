# SW Exchange Account Model

Current completed milestone: `v1.0.4 Admin Role Permissions`

## Account Status

User statuses are:

- `ACTIVE`: normal account behavior
- `FROZEN`: can login and view dashboard, wallets, ledger, orders, and trades, but cannot transfer, place orders, cancel orders, or trade through matching
- `BANNED`: cannot login; existing banned sessions are rejected by authenticated API requests

Transfer recipients and admin airdrop targets must be `ACTIVE`. Frozen users are blocked from receiving transfers and airdrops for the current safer/simple `v1.x` rule.

## Wallet Buckets

Normal users have `MAIN` wallets only.

The admin user has:

- `MAIN`: the admin user's ordinary internal wallet
- `FEE`: active platform trading fee wallet
- `TREASURY`: placeholder platform treasury wallet
- `AIRDROP`: placeholder future airdrop source wallet
- `HOT`: placeholder future chain hot wallet

Fees go to the admin `FEE` wallet. Buyer fees are collected in the traded base asset; seller fees are collected in the quote asset.

Airdrops are still unlimited in current `v1.x` and do not deduct from the `AIRDROP` wallet.

Current asset creation eagerly creates zero-balance `MAIN` wallets for existing users and zero-balance admin `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, and `HOT` wallets idempotently.

## Asset Metadata

Assets may have optional display metadata:

- display name
- icon URL
- icon source
- sort order
- description

Listed assets such as `SWC`, `SWL`, and `SWD` remain internal simulation assets. Admins can manually add more custom assets and set icon URLs directly. Metadata does not affect balances, transfer eligibility, matching, fee calculation, or status rules.

## Portfolio Valuation

Portfolio valuation is informational only and does not move wallet balances.

- `SWC` is valued at `1 SWC`
- Non-`SWC` assets are valued from their latest real `*/SWC` last price when available
- Available and locked balances are both included in each asset total
- If no market price exists for a non-`SWC` asset, that asset valuation remains pending and total equity excludes it
- No fake prices are generated

## Transfers

Normal internal transfers are free and always move `MAIN` to `MAIN`.

Allowed normal transfers:

- normal user `MAIN` to normal user `MAIN`
- normal user `MAIN` to admin `MAIN`
- admin `MAIN` to normal user `MAIN`

The logged-in user can only transfer from their own `MAIN` wallet. Admin cannot use normal transfer to move funds from one user to another, and users cannot transfer to admin system wallet buckets.

Admin bucket transfers are free and only move funds between the admin user's own wallet buckets for the same asset. They never move funds directly to normal users.

## Asset And Market Status

Assets are either active or paused.

- Paused assets remain visible in wallets and balance views
- Paused assets cannot be transferred or airdropped
- Paused assets cannot be used for new orders

Markets such as `SWL/SWC`, `SWD/SWC`, and later admin-created `BASE/QUOTE` pairs are either `ACTIVE` or `PAUSED`.

- Paused markets block new orders and matching
- Order book and trade history remain viewable
- Active users may still cancel existing open orders while the market is paused so locked funds can unlock

## Future Planning Boundary

- No blockchain features are implemented now.
- Future chain metadata, deposit, withdraw, custody, and reconciliation plans are documented separately and remain planned-only.
- Internal transfers remain free.
- The `HOT` wallet bucket is only a placeholder in current `v1.x`.

See:

- [EXCHANGE_BOUNDARY.md](./EXCHANGE_BOUNDARY.md)
- [HOT_WALLET_MODEL.md](./HOT_WALLET_MODEL.md)
- [V1_CHAIN_GATEWAY_PLAN.md](./V1_CHAIN_GATEWAY_PLAN.md)

## Administrative Identity and Roles (v1.0.4)

The existing USER/ADMIN identity boundary remains authoritative. Four related RBAC tables attach multiple reviewed roles to an ADMIN: `viewer` (read-only), `operator` (ordinary user status/assets/markets, no financial writes), `super_admin` (explicit full registry). Existing non-system ADMINs receive super_admin in migration 0015 because their prior authority was already full; ordinary USERs are never selected.

Role replacement changes base identity to ADMIN for nonempty roles and USER for an empty set, increments only the affected account's authVersion, and revokes pending proofs/login challenges. A FROZEN admin can still use ordinary account reads but no admin API; BANNED sessions remain invalid. Reactivation cannot revive prior sessions. Removing authority preserves wallets/balances and all historical activity; it never transfers system-wallet ownership.

Role/status mutations share a PostgreSQL advisory lock, recheck actor authority/version and protect the final active super-admin. Administrator status management always requires admin_roles.manage, even when granular rollout is disabled. Self-role changes are refused. See [complete role registry, migration assumptions and recovery](./ADMIN_ROLE_PERMISSIONS.md).

### Protected configured fee identity

The ADMIN_EMAIL account remains the existing fee principal. Role replacement cannot remove its base ADMIN identity (409 under the shared lock), even when other super-admins exist. Its human account can still be frozen/banned by another authorized administrator when last-super/self protections allow: sessions are revoked while the unchanged fee lookup continues receiving fees into the same FEE wallet. No balances or fee ownership move. Complete platform-principal separation is deferred; see [remediation evidence](./V1_0_4_REMEDIATION.md).
