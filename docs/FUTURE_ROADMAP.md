# SW Exchange Future Roadmap

This plan documents intended future work after `v0.15 Market Orders / Taker Flow`. These items are not live until their milestone is implemented.

## Completed Baseline

- `v0.11 Asset Metadata + Icon System` is completed.
- `v0.12 Multi-Market Foundation` is completed.
- `v0.13 Admin Asset / Market Creation` is completed.
- `v0.14 K-line / Candlestick Chart` is completed.
- `v0.14.1 Exchange-style K-line Chart` is completed.
- `v0.15 Market Orders / Taker Flow` is completed.
- Multiple internal markets are supported, including admin-created listings.
- K-line candles are generated from existing trades with no fake chart data, and `/trade` now has an interactive exchange-style chart with hover OHLC and volume.
- Market orders use IOC-like taker behavior and never rest on the order book.
- Deposit, withdraw, and blockchain features are not live.

## Future scope remains uncommitted

- Future v0.x polish may refine exchange UX, reporting, and operational controls.
- No future scope is committed as live until it is implemented and documented.

## v1.x Chain Gateway

- BSC deposit and withdraw planning
- Every user/admin may have an independent chain deposit address
- Deposits credit internal `MAIN` wallet after confirmation
- Withdrawals debit or freeze `MAIN` wallet and may be broadcast from shared `HOT` wallet
- Deposit has no platform fee in the current plan
- Withdrawal may have network or platform fees later
- `HOT` wallet remains a placeholder until v1.x
- No blockchain feature is implemented in v0.15
