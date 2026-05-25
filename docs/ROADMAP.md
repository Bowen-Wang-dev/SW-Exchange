# SW Exchange Roadmap

SW Exchange is being built in focused milestones so we can keep the simulated exchange narrow, testable, and easy to extend.

## Milestone status

Current completed milestone: `v0.18.2 Admin Operations / Risk Controls Polish`

Next milestone: `v0.18.3 Pre-v1 Stabilization / Release Candidate`

### v0.18.2 Admin Operations / Risk Controls Polish - Completed

- Added safer admin confirmation dialogs for user, asset, market, fee, large-airdrop, and bucket-transfer actions
- Added search/filter polish for admin users, assets, markets, audit logs, and ledger review
- Clarified admin wallet bucket roles and improved operational dashboard readability
- No matching logic, market-order behavior, fee logic, wallet rules, transfer rules, schema, or migrations changed

### v0.18.1 Light Mode / Theme Polish - Completed

- Added dark/light theme tokens while preserving the dark CEX-style default
- Added a top-nav theme toggle with `localStorage` persistence and client-safe initialization
- Cleaned up hardcoded dark surfaces across major user/admin pages and the trade terminal
- No product behavior, API behavior, schema, or migrations changed

### v0.1 Foundation - Completed

- Monorepo scaffold with `apps/api`, `apps/web`, and `packages/shared`
- NestJS API foundation
- Next.js web foundation
- PostgreSQL and Drizzle ORM setup
- Docker Compose local database workflow
- Seed script and smoke test

### v0.18 AI-Native Project Docs / Codex Context Pack - Completed

- Added an AI-native documentation pack for architecture state, business rules, API contracts, terminology, event flow, testing rules, release workflow, UI style, limitations, and known tech debt
- Refreshed roadmap/version/account documentation for current-state accuracy
- Updated app-facing milestone copy to `v0.18`
- No product behavior, API behavior, schema, or migrations changed

### v0.17.4 Trading Interaction Polish - Completed

- Order book bid/ask prices fill the Limit price input without submitting orders
- Recent trade prices fill the Limit price input without submitting orders
- Best Bid, Best Ask, and Last quick price controls use existing ticker/order-book data
- Open Orders includes current-market Cancel All, Cancel Buy, and Cancel Sell controls for user open limit orders
- Open order rows show type, side, price, amount, filled, remaining, status, quote flow, and per-order cancel action in compact cards
- No matching logic, market-order behavior, fee rules, wallet rules, schema, deposit, withdraw, blockchain integration, or new order types are added

### v0.17.3 Markets Sorting / Favorites Polish - Completed

- `/markets` supports sorting by 24h volume, 24h change, last price, symbol, best bid, best ask, and newly listed
- Market search covers symbols, base/quote assets, asset names, and display names
- Quote, status, and favorites-only filters compose with sorting and search
- Local favorites persist in `localStorage` and can be toggled without row navigation
- Compact overview sections show Favorites, Top Gainers, Top Losers, Trending, and Newly Listed markets
- Full market rows are clickable and avoid horizontal scrolling as the primary layout solution
- No matching logic, market-order behavior, fee rules, wallet rules, schema, deposit, withdraw, blockchain integration, or new order types are added

### v0.17.2 Portfolio / Asset Display Polish - Completed

- Dashboard and Wallet asset displays support sorting by estimated value, token amount, symbol, available balance, and locked balance
- Asset search works by symbol, asset name, and display name
- Hide-zero and hide-`< 1 SWC` controls reduce clutter without incorrectly hiding unpriced assets
- Asset rows show icon, symbol, display name, available, locked, total, estimated price, estimated value, and related Trade action when an active market exists
- Portfolio summary cards make total equity, visible balances, locked balances, priced assets, and valuation-pending states easier to scan
- No matching logic, market-order behavior, fee rules, wallet rules, schema, deposit, withdraw, blockchain integration, or new order types are added

### v0.17.1 Smoke Idempotency / Local DB Test Stability - Completed

- Smoke scenarios use per-run assets and markets for fee, matching, market-data, and market-order isolation
- Assertions are scoped to smoke-created users, orders, markets, and trades
- Reused local DBs no longer need a manually empty seeded `SWL/SWC` order book for smoke to pass
- No product behavior, API behavior, matching logic, fee rules, wallet rules, transfer rules, schema, or migrations changed

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

### v0.12 Multi-Market Foundation - Completed

- Removed `SWL/SWC` hardcoding where practical from app-facing exchange behavior
- Existing `SWL/SWC` market remains supported
- Seeded demo asset `SWD` and market `SWD/SWC`
- Market summaries return all seeded markets
- Ticker, order book, recent trades, order placement, matching, and trade records use the selected market
- Matching only considers orders in the same market
- `/trade` defaults to `SWL/SWC` and includes a seeded-market selector
- `/markets` lists all seeded markets and links to the selected market trade view
- User/admin order and trade history support market filters
- Existing users/admin receive missing active-asset wallets idempotently without balance resets
- Portfolio valuation remains SWC-based and leaves unpriced assets pending
- No admin asset creation, admin market creation, K-line, market orders, deposit, withdraw, blockchain integration, or chain addresses are implemented

### v0.13 Admin Asset / Market Creation - Completed

- `POST /api/admin/assets` creates virtual assets with manual metadata and status
- Asset symbols normalize to uppercase, stay unique, and create `CREATE_ASSET` audit logs
- New assets eagerly create zero-balance `MAIN` wallets for existing users and zero-balance admin `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, and `HOT` wallets idempotently
- `POST /api/admin/markets` creates new `BASE/QUOTE` spot markets from listed assets
- Active market creation requires both assets to already be `ACTIVE`; paused assets can still back a paused market
- New markets bootstrap default fee settings automatically and create `CREATE_MARKET` audit logs
- Optional market configuration supports `pricePrecision`, `amountPrecision`, `minOrderAmount`, and `minNotional`
- `/admin/assets` includes a create form while keeping existing asset metadata editing and status controls
- `/admin/markets` lists markets, shows last price when available, and supports market creation plus pause/resume
- `/admin/fees` can review/update fee settings per market
- `/assets`, `/markets`, `/trade`, ticker, order book, trades, matching, fees, and SWC valuation all include admin-created listings using the existing foundation
- No fake trades/order book, K-line, market orders, deposit, withdraw, blockchain integration, or chain addresses are implemented

### v0.14 K-line / Candlestick Chart - Completed

- `GET /api/markets/candles?marketSymbol=...&interval=...`
- Candles are generated on demand from existing settled trades
- Supported intervals are `1m`, `5m`, `15m`, `1h`, and `1d`
- Candle buckets include open, high, low, close, base volume, quote volume, trade count, start time, and end time
- Aggregation is market-specific and does not mix trades across markets
- `/trade` shows a compact dark candlestick chart for the selected market
- Empty markets show a clear no-trades chart state
- No fake K-line data, market orders, deposit, withdraw, blockchain integration, or chain addresses are implemented

### v0.14.1 Exchange-style K-line Chart - Completed

- `/trade` upgrades the chart area from the basic generated SVG-style K-line into an interactive exchange-style candlestick chart
- `lightweight-charts` renders real candles with a right-side price scale and bottom time scale
- A lower volume pane shows per-candle base volume
- Desktop hover shows crosshair plus an OHLC panel with time, open, high, low, close, change, change %, volume, quote volume, and trade count
- Market and interval switching continue to use the existing `/api/markets/candles` endpoint
- Empty markets still show the no-trades K-line state
- No technical indicators, depth chart, market orders, deposit, withdraw, blockchain integration, or chain addresses are implemented

### v0.15 Market Orders / Taker Flow - Completed

- `POST /api/orders` supports `type: LIMIT | MARKET`
- Market Buy accepts quote spend input and consumes lowest asks first
- Market Sell accepts base amount input and consumes highest bids first
- Same-price matching still uses earliest-created order priority
- Trade price remains the resting maker order price
- Executed market-order fills settle immediately with existing buyer base-asset fees and seller quote-asset fees
- Unfilled market-order remainder is automatically cancelled and never rests on the order book
- Partial market fills use `PARTIAL_FILLED_CANCELLED`
- `POST /api/orders/preview` estimates fill amount, quote spend/receive, average price, fees, trade count, and liquidity status without mutating balances
- No-liquidity market orders return `NO_LIQUIDITY` without balance or trade mutation
- No deposit, withdraw, blockchain integration, chain addresses, stop-loss, take-profit, post-only, fill-or-kill, leverage, futures, or contracts are implemented

### v0.16.2 Exchange UI Polish - Completed

- `/markets` adds compact Top Gainers, Newly Listed, and Trending sections above the full market table
- Full market rows are clickable and open the selected market in `/trade`
- Trade navigation opens a hoverable market discovery panel
- Market pair icons are kept clean and readable in trade and markets views
- Dashboard tables scroll horizontally instead of clipping right-side columns
- No matching, fee, transfer, schema, deposit, withdraw, or blockchain behavior changed

### v0.17 Professional Trading Terminal Layout - Completed

- `/trade` now uses a professional terminal composition with a compact ticker bar, dominant chart, adjacent order book and recent trades, fixed desktop order-entry rail, and docked bottom activity tabs
- The left workspace stays flexible while the order-entry rail remains visible beside chart and depth on desktop
- Core trade-terminal information no longer relies on page-level horizontal scrolling at normal desktop widths
- The layout direction is informed by `docs/ui-references/bybit-trade-layout-summary.md`
- Matching, fee, wallet, API, and schema behavior remain unchanged

### v0.16.3 Exchange Layout Polish - Completed

- Dashboard asset valuation no longer relies on internal horizontal scrolling
- `/markets` full market list fits the page without horizontal-scroll table behavior
- `/trade` top market header uses the right side for compact ticker stats
- Trade market selector rows remain compact with vertical-only scrolling for long lists
- Pair icons stay consistent and readable across touched exchange surfaces
- No matching, fee, transfer, API, schema, deposit, withdraw, or blockchain behavior changed

### v0.16 Trading UX / Order Safety Polish - Completed

- `/trade` replaces the native market select with a searchable exchange-style market selector opened from the header
- The selector shows icons, market symbol, last price, 24h change, 24h volume, and market status
- LIMIT and MARKET orders now use a lightweight confirmation step before submission
- `POST /api/orders/preview` also supports LIMIT-order fee and immediate-match confirmation metadata
- Market-order preview messaging now highlights `FULL`, `PARTIAL`, and `NONE` liquidity states more clearly
- No-liquidity market orders are blocked earlier in the web flow
- Quick-fill `25%`, `50%`, `75%`, `100%`, and `Max` controls help size limit and market orders from displayed balances
- User and admin order-history tables now make LIMIT vs MARKET execution details easier to read
- No deposit, withdraw, blockchain integration, chain addresses, stop-loss, take-profit, post-only, leverage, futures, or contracts are implemented

### v1.x Chain Gateway - Planned

- BSC deposit and withdraw planning
- Every user/admin may have an independent chain deposit address
- Deposits credit internal `MAIN` wallet after confirmation
- Withdrawals debit or freeze `MAIN` wallet and may be broadcast from shared `HOT` wallet
- Deposit has no platform fee in the current plan
- Withdrawal may have network or platform fees later
- `HOT` wallet remains a placeholder until v1.x
- No blockchain feature is implemented in v0.17
