# SW Exchange Future Roadmap

This plan documents intended future work after `v0.10 Market Data + Portfolio Valuation`. These items are not live until their milestone is implemented.

## v0.11 Asset Metadata + Icon System

- Asset icons
- Default placeholder icons
- Public icon source matching for known assets if feasible
- Admin manual icon URL or upload
- Icons displayed in wallet, markets, trade header, and admin assets
- Public source icons can be overridden by admin

## v0.12 Multi-Market Foundation

- Remove `SWL/SWC` hardcoding where practical
- Support multiple markets internally
- Market selector
- Each market has independent order book, trades, and ticker

## v0.13 Admin Asset / Market Creation

- Admin can create assets manually
- Admin can create markets from base/quote assets
- Precision, minimum order, and minimum notional settings if needed
- Market status controls

## v0.14 K-line / Candlestick Chart

- OHLC data from trades
- Intervals such as `1m`, `5m`, `15m`, `1h`, and `1d`
- Lightweight chart first
- No TradingView-level complexity required initially

## v0.15 Market Orders / Taker Flow

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
- No blockchain feature is implemented in v0.10
