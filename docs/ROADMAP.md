# SW Exchange Roadmap

SW Exchange is being built in focused milestones so we can keep the simulated exchange narrow, testable, and easy to extend.

## Planned milestones

### v0.1 Foundation

- Monorepo scaffold with `apps/api`, `apps/web`, and `packages/shared`
- NestJS API foundation
- Next.js web foundation
- PostgreSQL and Drizzle ORM setup
- Docker Compose local database workflow
- Seed script and smoke test

### v0.2 Auth + CEX UI Shell

- Frontend auth integration with existing API endpoints
- Dark, professional exchange-style application shell
- Protected user and admin routes
- Redesigned placeholder screens for dashboard, wallet, trade, and admin areas

### v0.3 Admin Airdrop + Wallet Viewer

- Admin wallet visibility
- Admin airdrop execution flow
- Related ledger and audit visibility

### v0.4 Internal Transfer

- User-to-user internal transfer flow
- Transfer validation
- Transfer ledger recording

### v0.5 Limit Order + Order Book

- Limit order placement
- Order cancellation
- Order book display for `SWL/SWC`

### v0.6 Matching Engine + Trades

- Trade matching engine
- Trade settlement
- User and admin trade history

### v0.7 User Ledger + Admin Audit

- Full user ledger views
- Expanded admin audit tooling
- Stronger operational traceability

### v1.x BSC deposit/withdraw, market orders, K-line

- BSC deposit
- BSC withdraw
- Market orders
- K-line / candlestick charting
