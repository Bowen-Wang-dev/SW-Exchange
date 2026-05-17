# SW Exchange Roadmap

SW Exchange is being built in focused milestones so we can keep the simulated exchange narrow, testable, and easy to extend.

## Milestone status

Current completed milestone: `v0.11 Asset Metadata + Icon System`

Next milestone: `v0.12 Multi-Market Foundation`

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

## Milestone details and upcoming work

### v0.6 Matching Engine + Trades + WebSocket Sync - Completed

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
- Lightweight polling sync for order book, trades, orders, and displayed balances
- Self-trade prevention for crossed orders from the same user
- No fee system in this milestone; fees are completed in v0.7

### v0.7 Admin Fee System + Fee Settlement - Completed

- Admin configurable fee settings for `SWL/SWC`
- Default buyer and seller fee rates of `0.1%`
- Fee rates stored as integer basis points
- Buyer fee charged from received `SWL`
- Seller fee charged from received `SWC`
- Admin `FEE` wallet bucket for collected fees
- Trade records persist fee amounts, fee asset IDs, and execution-time fee rates
- Fee settlement uses bigint minimal-unit math and floor rounding
- `FEE` ledger entries for user fees charged and admin Fee Wallet income
- Admin audit logs for `UPDATE_FEE_SETTINGS`
- `/admin/fees` dashboard page with admin Fee Wallet balances
- User and admin trade tables show fees

### v0.7.1 Admin Wallet Buckets / Wallet Model Polish - Completed

- No separate active `FEE_ACCOUNT`, `TREASURY_ACCOUNT`, `AIRDROP_ACCOUNT`, or `HOT_WALLET_ACCOUNT` users are required
- Platform balances are represented as admin wallet buckets
- Admin wallet buckets are `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, and `HOT`
- Normal users only have `MAIN` wallets
- Admin has `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, and `HOT` wallets for `SWC` and `SWL`
- Fee settlement credits admin `FEE`, not admin `MAIN`
- `/admin/wallets` page has Admin Wallet and System Wallets tabs
- Normal transfers are `MAIN` to `MAIN` only
- Admin bucket transfers are internal, free, admin-only moves between the admin user's own buckets
- Airdrops remain unlimited in v0.x and do not debit the `AIRDROP` bucket
- `HOT` is a future v1.x chain wallet placeholder; no blockchain, deposit, or withdraw logic is implemented

### v0.8 Admin Controls + User Status Management - Completed

- Admin can set user status to `ACTIVE`, `FROZEN`, or `BANNED`
- `FROZEN` users can login and view balances/history, but cannot transfer, place orders, cancel orders, or trade through matching
- `BANNED` users cannot login, and existing banned sessions are rejected by authenticated API requests
- Transfer recipients and admin airdrop targets must be `ACTIVE`
- Admin can pause/resume `SWC` and `SWL`; paused assets block transfers, airdrops, and new orders involving that asset
- Admin can pause/resume the `SWL/SWC` market
- Paused markets block new orders and matching while order book/history remain viewable
- Active users can still cancel open orders while a market is paused so funds can unlock
- Admin audit logs include `UPDATE_USER_STATUS`, `UPDATE_ASSET_STATUS`, and `UPDATE_MARKET_STATUS`
- No deposit, withdraw, blockchain, chain address, market order, K-line, futures, contract, or leverage behavior is implemented

### v0.9 Ledger / Audit / Reports Polish

- Completed
- User ledger readability polish with consistent table columns, amount styling, filters, and empty states
- Admin ledger readability polish with owner, role, wallet type, asset/type/user filters, and clear admin bucket entries
- Admin audit log readability polish with action badges, filters, summaries, and expandable before/after JSON details
- Admin dashboard report cards for users, wallets, orders, trades, transfers, fee wallet balances, paused assets, and paused markets
- `GET /api/admin/reports/summary` provides simple admin-only reporting data and recent activity
- Lightweight client-side CSV exports for admin ledger, audit logs, trades, and transfers
- No trading, matching, fee calculation, transfer rule, wallet bucket model, user/asset/market status, deposit, withdraw, or chain behavior changed

### v0.10 Market Data + Portfolio Valuation - Completed

- `GET /api/markets/ticker?marketSymbol=SWL/SWC`
- `GET /api/markets/summary`
- `GET /api/wallets/me/valuation`
- Best bid is the highest open BUY price
- Best ask is the lowest open SELL price
- Last price comes from the most recent settled trade
- 24h high, low, volume, quote volume, change, and trade count come from settled trade history
- Portfolio valuation is denominated in `SWC`
- `SWC` is valued at `1 SWC`
- `SWL` valuation uses the latest real `SWL/SWC` last price
- If no last price exists, SWL valuation remains pending and no fake price is shown
- `/trade`, `/markets`, `/dashboard`, `/wallet`, and `/admin` surface the new market data where appropriate
- No K-line, market orders, multi-market creation, deposit, withdraw, blockchain integration, chain addresses, admin asset creation, or admin market creation is implemented

### v0.11 Asset Metadata + Icon System - Completed

- Asset metadata fields: display name, icon URL, icon source, sort order, and description
- `GET /api/assets` includes metadata for frontend and admin use
- Admin metadata endpoint at `PATCH /api/admin/assets/:symbol/metadata`
- Admin can set or clear display name, icon URL, description, and sort order
- Metadata updates write `UPDATE_ASSET_METADATA` audit logs
- SWC and SWL seed/backfill metadata without resetting existing balances
- Shared frontend `AssetIcon` fallback/avatar component
- Icons/fallbacks appear in wallet, dashboard, markets, trade, ledger, fees, and admin asset views where practical
- Known public icon mapping remains local/static; admin `iconUrl` overrides the mapping
- Upload is deferred as future polish
- No matching, fee, transfer, wallet bucket, or user/asset/market status rules changed

### v0.12 Multi-Market Foundation - Planned

- Remove `SWL/SWC` hardcoding where practical
- Support multiple markets internally
- Market selector
- Each market has independent order book, trades, and ticker

### v0.13 Admin Asset / Market Creation - Planned

- Admin can create assets manually
- Admin can create markets from base/quote assets
- Precision, minimum order, and minimum notional settings if needed
- Market status controls

### v0.14 K-line / Candlestick Chart - Planned

- OHLC data from trades
- Intervals such as `1m`, `5m`, `15m`, `1h`, and `1d`
- Lightweight chart first
- No TradingView-level complexity required initially

### v0.15 Market Orders / Taker Flow - Planned

- Market buy
- Market sell
- Liquidity checks
- Estimated receive
- Slippage warning
- No fake fills if liquidity is insufficient

### v1.x Chain Gateway - Planned

- BSC deposit and withdraw planning
- Every user/admin may have an independent chain deposit address
- Deposits credit internal `MAIN` wallet after confirmation
- Withdrawals debit or freeze `MAIN` wallet and may be broadcast from shared `HOT` wallet
- Deposit has no platform fee in the current plan
- Withdrawal may have network or platform fees later
- `HOT` wallet remains a placeholder until v1.x
- No blockchain feature is implemented in v0.11
