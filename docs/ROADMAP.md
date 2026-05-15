# SW Exchange Roadmap

SW Exchange is being built in focused milestones so we can keep the simulated exchange narrow, testable, and easy to extend.

## Milestone status

Current completed milestone: `v0.5 Limit Order + Order Book`

Next milestone: `v0.6 Matching Engine + Trades + WebSocket Sync`

### v0.1 Foundation - Completed

- Monorepo scaffold with `apps/api`, `apps/web`, and `packages/shared`
- NestJS API foundation
- Next.js web foundation
- PostgreSQL and Drizzle ORM setup
- Docker Compose local database workflow
- Seed script and smoke test

### v0.2 Auth + CEX UI Shell - Completed

- Frontend auth integration with existing API endpoints
- Dark, professional exchange-style application shell
- Protected user and admin routes
- Redesigned placeholder screens for dashboard, wallet, trade, and admin areas

### v0.3 Admin Airdrop + Wallet Viewer - Completed

- Admin user and wallet visibility
- User wallet viewer backed by real balances
- Transaction-safe admin airdrop execution for `SWC` and `SWL`
- Ledger entries for airdrops
- Admin audit logs for airdrops
- User and admin ledger viewers
- Exact decimal parsing/formatting helpers for minimal-unit balances

### v0.4 Internal Transfer - Completed

- User-to-user internal transfer flow
- Transfer target by username or email
- Transfer validation for active users, active assets, self-transfer, amount format, and available balance
- Transfer ledger recording with paired `TRANSFER_OUT` and `TRANSFER_IN` entries
- User transfer history
- Admin transfer list
- `FROZEN` and `BANNED` recipients are blocked from receiving for the safer/simple v0.4 rule

### v0.5 Limit Order + Order Book - Completed

- Limit order placement for `SWL/SWC`
- BUY orders lock quote asset `SWC`
- SELL orders lock base asset `SWL`
- Order cancellation unlocks remaining locked balance
- Order book display grouped by price for bids and asks
- User order history and open-order cancellation
- Admin order list
- `ORDER_LOCK` and `ORDER_UNLOCK` ledger entries
- No matching engine, trades, fees, market orders, or K-line chart

## Planned milestones

### v0.6 Matching Engine + Trades + WebSocket Sync

- Matching engine for `SWL/SWC`
- Trade creation and user/admin trade history
- Partial fills
- Multi-order matching
- Price priority
- Time priority
- Maker-price execution
- Order state transitions
- Balance mutation during trade settlement
- Transaction rollback safety around matching and settlement
- WebSocket or equivalent real-time sync for order book, trades, and orders if feasible
- No fee system in this milestone; fees move to v0.7

### v0.7 Admin Fee System + Fee Settlement

- Admin configurable fee settings
- Fee rate management in the admin dashboard
- Buyer fee rate and seller fee rate controls
- Fee settlement
- Fee account handling
- Fee ledger entries
- Admin audit logs for fee setting changes

### v0.8 Ledger / Audit / Reports polish

- Ledger, audit, and reporting polish if needed
- Reporting views or operational summaries if needed
- Stronger operational traceability and review ergonomics

### v1.x BSC deposit/withdraw, market orders, K-line

- BSC deposit
- BSC withdraw
- Market orders
- K-line / candlestick charting
