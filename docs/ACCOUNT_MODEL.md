# SW Exchange Account Model

Current completed milestone: `v0.7.1 Admin Wallet Buckets / Wallet Model Polish`

## Wallet Buckets

Normal users have `MAIN` wallets only.

The admin user has:

- `MAIN`: the admin user's ordinary internal wallet
- `FEE`: active platform trading fee wallet
- `TREASURY`: placeholder platform treasury wallet
- `AIRDROP`: placeholder future airdrop source wallet
- `HOT`: placeholder future chain hot wallet

Fees go to the admin `FEE` wallet. Buyer fees are collected in `SWL`; seller fees are collected in `SWC`.

Airdrops are still unlimited in current v0.x and do not deduct from the `AIRDROP` wallet.

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

## Future v1.x Blockchain Plan

No blockchain features are implemented now.

Future plans may add:

- independent chain deposit addresses for every user/admin account
- deposits that credit internal `MAIN` wallets after chain confirmation
- withdrawals that debit or freeze `MAIN` wallets and may broadcast from a shared `HOT` wallet
- no deposit platform fee in the current plan
- possible network or platform fees for withdrawals later

Internal transfers remain free. The `HOT` wallet bucket is only a placeholder in v0.x.
