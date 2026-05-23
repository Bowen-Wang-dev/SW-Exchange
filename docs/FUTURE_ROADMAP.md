# SW Exchange Future Roadmap

This plan documents intended future work after `v0.14.1 Exchange-style K-line Chart`. These items are not live until their milestone is implemented.

## Completed Baseline

- `v0.11 Asset Metadata + Icon System` is completed.
- `v0.12 Multi-Market Foundation` is completed.
- `v0.13 Admin Asset / Market Creation` is completed.
- `v0.14 K-line / Candlestick Chart` is completed.
- `v0.14.1 Exchange-style K-line Chart` is completed.
- Multiple internal markets are supported, including admin-created listings.
- K-line candles are generated from existing trades with no fake chart data, and `/trade` now has an interactive exchange-style chart with hover OHLC and volume.
- Market orders, deposit, withdraw, and blockchain features are not live.

## v0.15 Market Orders / Taker Flow

- Next planned v0.x milestone
- Market buy
- Market sell
- Liquidity checks
- Estimated receive
- Slippage warning
- No fake fills if liquidity is insufficient

## v1.x Chain Gateway

- BSC deposit and withdraw planning
- Every user/admin may have an independent chain deposit address
- Deposits credit internal `MAIN` wallet after confirmation
- Withdrawals debit or freeze `MAIN` wallet and may be broadcast from shared `HOT` wallet
- Deposit has no platform fee in the current plan
- Withdrawal may have network or platform fees later
- `HOT` wallet remains a placeholder until v1.x
- No blockchain feature is implemented in v0.14.1
