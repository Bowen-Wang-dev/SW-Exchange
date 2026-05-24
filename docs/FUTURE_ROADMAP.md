# SW Exchange Future Roadmap

This plan documents intended future work after `v0.17.3 Markets Sorting / Favorites Polish`. These items are not live until their milestone is implemented.

## Completed Baseline

- `v0.11 Asset Metadata + Icon System` is completed.
- `v0.12 Multi-Market Foundation` is completed.
- `v0.13 Admin Asset / Market Creation` is completed.
- `v0.14 K-line / Candlestick Chart` is completed.
- `v0.14.1 Exchange-style K-line Chart` is completed.
- `v0.15 Market Orders / Taker Flow` is completed.
- `v0.16 Trading UX / Order Safety Polish` is completed.
- `v0.16.2 Exchange UI Polish` is completed.
- `v0.16.3 Exchange Layout Polish` is completed.
- `v0.17 Professional Trading Terminal Layout` is completed.
- `v0.17.1 Smoke Idempotency / Local DB Test Stability` is completed.
- `v0.17.2 Portfolio / Asset Display Polish` is completed.
- `v0.17.3 Markets Sorting / Favorites Polish` is completed.
- Multiple internal markets are supported, including admin-created listings.
- K-line candles are generated from existing trades with no fake chart data, and `/trade` now has an interactive exchange-style chart with hover OHLC and volume.
- Market orders use IOC-like taker behavior and never rest on the order book.
- `/trade` now includes an exchange-style market selector, compact ticker header, dominant chart, adjacent depth/tape, fixed desktop order rail, bottom activity tabs, order confirmation, market-order risk messaging, and quick-fill controls.
- Dashboard and Wallet now include sortable, searchable portfolio asset rows with hide-zero and hide-dust controls.
- `/markets` now includes local favorites, sorting, search, quote/status filters, and compact discovery sections.
- Deposit, withdraw, and blockchain features are not live.

## Planned v0.x polish

- `v0.17.4 Trading Interaction Polish` may refine order-entry feedback, keyboard flow, and trading-terminal interactions.

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
- No blockchain feature is implemented in v0.17.3
