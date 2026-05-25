# SW Exchange v0.x

SW Exchange v0.x is a simulated exchange runtime for custom assets and custom markets.

Current completed milestone: `v0.20 Exchange Boundary + v1/v2 Planning Docs`

Next milestone: `v1.0 Auth Security + Feature Flags`

AI-native docs index: [`docs/README.md`](./docs/README.md)

This version is intentionally limited:

- No blockchain integration
- No deposit or withdraw
- No chain token gateway integration in `v0.x`
- No KYC
- No stop-loss, take-profit, post-only, fill-or-kill, leverage, futures, or contracts
- No fee discounts, VIP tiers, or maker/taker tiers yet

Current scope:

- Public registration
- JWT login
- Internal wallets
- User wallet viewer
- User ledger viewer
- Admin user and wallet viewer
- Admin active-asset airdrop flow
- User SWC/SWL internal transfer flow
- User and admin transfer history
- Admin ledger and audit log viewer
- Market-aware limit order placement and cancellation
- Market order taker flow for immediate BUY/SELL execution
- Market-aware automatic matching with price-time priority
- Market-aware trade recording and trade history
- Market-specific order book grouped by price
- Interactive trade-derived K-line / candlestick chart on `/trade`
- User and admin order history
- User and admin trade history
- ORDER_LOCK and ORDER_UNLOCK ledger entries
- TRADE_BUY and TRADE_SELL ledger entries
- Admin-configurable buyer and seller trading fees
- Admin Fee Wallet bucket for collected trading fees
- Admin MAIN/FEE/TREASURY/AIRDROP/HOT wallet bucket model
- Trade records with persisted fee amounts and fee rates
- FEE ledger entries for fees charged and fee income
- Admin user freeze/ban controls
- Admin asset pause/resume controls
- Admin seeded-market pause/resume controls
- Admin audit logs for user, asset, and market status changes
- Polished user and admin ledger tables with filters
- Polished admin audit log table with readable before/after details
- Admin reports summary cards and recent activity
- Market ticker from selected-market trades and open orders
- Best bid and best ask from the open order book
- Last price, 24h high/low/volume/quote volume/change from settled trades
- User portfolio valuation in `SWC` using real balances and latest available `*/SWC` market prices
- Wallet estimated value column for priced assets
- Sortable, searchable Dashboard and Wallet asset displays with hide-zero and hide-dust controls
- Trade links from portfolio assets to active related markets where available
- Admin market summary card for last price, 24h volume, open orders, and total trades
- Asset metadata fields for display name, icon URL, icon source, sort order, and description
- Clean fallback asset icons across user and admin asset displays
- Admin asset metadata editing for display name, icon URL, description, and sort order
- Admin audit logs for asset metadata changes
- Seeded demo market `SWD/SWC` alongside existing `SWL/SWC`
- Exchange-style market selector on `/trade`
- Market summary list includes all seeded markets
- Sortable, searchable `/markets` discovery with quote/status filters and local favorites
- Compact market overview sections for favorites, gainers, losers, trending, and newly listed markets
- Admin asset creation endpoint and `/admin/assets` form
- Admin market creation endpoint and `/admin/markets` form
- Eager zero-balance wallet coverage for new assets across existing users and admin buckets
- Default fee-setting bootstrap for newly created markets
- Public `/assets` directory for listed simulation assets
- Market Buy uses quote spend input and never locks unspent quote long-term
- Market Sell uses base amount input and only deducts executed sold base
- LIMIT and MARKET order confirmation with risk summary before placement
- Market-order liquidity status, warning, and execution summary polish
- Quick-fill percentage and Max controls on `/trade`
- Clearer user/admin order-history display for LIMIT vs MARKET execution outcomes
- No-horizontal-scroll exchange layouts for dashboard valuation and market browsing
- Compact trade ticker header with selected market and 24h stats in one exchange-style strip
- Professional CEX-style `/trade` terminal layout with compact ticker bar, dominant chart, adjacent order book and recent trades, fixed desktop order-entry rail, and docked bottom activity tabs
- Order book and recent trade prices on `/trade` can fill the Limit price input without placing an order
- Best Bid, Best Ask, and Last quick price controls on `/trade`
- Current-market Cancel All, Cancel Buy, and Cancel Sell controls for user open limit orders
- Persisted Light / Dark theme toggle with token-based exchange UI surfaces
- Admin operations console polish with safer confirmations, search/filter controls, audit/ledger export filtering, and clearer wallet bucket guidance
- One-command local/VPS-style Docker Compose production demo runtime with deploy and verify scripts

## Milestone status

- `v0.1 Foundation` completed
- `v0.2 Auth + CEX UI Shell` completed
- `v0.3 Admin Airdrop + Wallet Viewer` completed
- `v0.4 Internal Transfer` completed
- `v0.5 Limit Order + Order Book` completed
- `v0.6 Matching Engine + Trades + WebSocket Sync` completed
- `v0.7 Admin Fee System + Fee Settlement` completed
- `v0.7.1 Admin Wallet Buckets / Wallet Model Polish` completed
- `v0.8 Admin Controls + User Status Management` completed
- `v0.9 Ledger / Audit / Reports Polish` completed
- `v0.10 Market Data + Portfolio Valuation` completed
- `v0.11 Asset Metadata + Icon System` completed
- `v0.12 Multi-Market Foundation` completed
- `v0.13 Admin Asset / Market Creation` completed
- `v0.14 K-line / Candlestick Chart` completed
- `v0.14.1 Exchange-style K-line Chart` completed
- `v0.15 Market Orders / Taker Flow` completed
- `v0.16 Trading UX / Order Safety Polish` completed
- `v0.16.2 Exchange UI Polish` completed
- `v0.16.3 Exchange Layout Polish` completed
- `v0.17 Professional Trading Terminal Layout` completed
- `v0.17.1 Smoke Idempotency / Local DB Test Stability` completed
- `v0.17.2 Portfolio / Asset Display Polish` completed
- `v0.17.3 Markets Sorting / Favorites Polish` completed
- `v0.17.4 Trading Interaction Polish` completed
- `v0.18 AI-Native Project Docs / Codex Context Pack` completed
- `v0.18.1 Light Mode / Theme Polish` completed
- `v0.18.2 Admin Operations / Risk Controls Polish` completed
- `v0.18.3 Pre-v1 Stabilization / Release Candidate` completed
- `v0.19 One-Command Deploy / Docker Production Runtime` completed
- `v0.20 Exchange Boundary + v1/v2 Planning Docs` completed

- Current completed milestone: `v0.20 Exchange Boundary + v1/v2 Planning Docs`
- Next milestone: `v1.0 Auth Security + Feature Flags`

## Planned milestones

- `v1.0 Auth Security + Feature Flags`
- `v1.1 Chain Asset Registry`
- `v1.2 User Deposit Address Model`
- `v1.3 Deposit Monitor Detect-only`
- `v1.4 Deposit Credit Flow`
- `v1.5 Withdrawal Request`
- `v1.6 Withdrawal Approval + Broadcast`
- `v1.7 Gas / Withdrawal Fee Management`
- `v1.8 Chain Reconciliation / Audit`
- `v1.9 Chain Gateway Stabilization`
- `v2.x Margin / Futures Simulation`

## v0.20 Exchange Boundary + v1/v2 Planning Docs

v0.20 is a docs-only planning milestone. It defines what SW Exchange is and is not before any chain gateway, security-hardening, or margin/futures implementation work begins.

- Added boundary, gap-analysis, feature-flag, and `v1.x` / `v2.x` planning docs under [`docs/`](./docs/README.md)
- Clarified that `v0.x` remains an off-chain internal-accounting runtime for custom assets and custom markets
- Defined `v1.0` to `v1.9` planned-only sequence for auth/security, chain asset registry, deposit/withdraw flow, hot wallet, indexing, and reconciliation work
- Defined `v2.x` as optional, default-disabled margin/futures simulation planning only
- No matching logic, market-order behavior, fee calculation rules, wallet rules, transfer rules, schema, API behavior, deposit, withdraw, blockchain behavior, email verification, 2FA, margin, or futures behavior changed

## v0.19 One-Command Deploy / Docker Production Runtime

v0.19 adds a production-style local/VPS runtime path for the off-chain simulated exchange without changing trading-core, fee, wallet, transfer, schema, or API behavior.

- Added production Dockerfiles for the Nest API and Next web app using `pnpm` and Corepack
- Added `docker-compose.prod.yml` for Postgres, API, and web with persistent Postgres storage and health checks
- Added `.env.production.example` plus ignored `.env.production` workflow for deploy-time values and admin bootstrap credentials
- Added `./scripts/deploy-local.sh` to build, start, migrate, seed, and launch the production-style stack
- Added `./scripts/verify-deploy.sh` to verify compose status, API health, and web reachability
- No matching logic, market-order behavior, fee calculation rules, wallet rules, transfer rules, schema, deposit, withdraw, or blockchain behavior changed

## v0.18.3 Pre-v1 Stabilization / Release Candidate

v0.18.3 tightens the release-candidate edges of the off-chain simulated exchange without changing trading-core, fee, wallet, transfer, schema, or API behavior.

- Aligned app-facing milestone copy and top-level docs around the v0.x release-candidate state
- Clarified that v0.x remains off-chain, internal-accounting only, with no real deposit, withdraw, blockchain, chain-address, fiat-redemption, or real-money behavior
- Polished small empty states and route notices on core user surfaces to reduce misleading or stale copy
- Clarified local smoke/dev workflow expectations, including API/web startup requirements, reused-local-DB smoke behavior, and stale Next cache cleanup
- Marked local `sample/` reference captures as local-only workflow artifacts via ignore guidance
- No matching logic, market-order behavior, fee calculation rules, wallet rules, transfer rules, schema, API behavior, deposit, withdraw, or blockchain behavior changed

## v0.18.2 Admin Operations / Risk Controls Polish

v0.18.2 sharpens admin workflows without changing trading-core, fee, wallet, or transfer behavior.

- Added safer confirmation dialogs for user status changes, asset status changes, market status changes, fee updates, large airdrops, and admin bucket transfers
- Added admin search/filter polish across users, assets, markets, audit logs, and ledger review
- Clarified wallet bucket roles for `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, and `HOT`
- Improved admin dashboard and reporting readability with clearer operational cards and recent activity emphasis
- No matching logic, market-order behavior, fee calculation rules, wallet rules, transfer rules, schema, deposit, withdraw, or blockchain behavior changed

## v0.18.1 Light Mode / Theme Polish

v0.18.1 adds a polished light theme while keeping the dark exchange terminal as the default first-class experience.

- Added theme tokens for page backgrounds, panels, borders, text, inputs, and semantic status colors
- Added a global Light / Dark toggle in the top navigation with `localStorage` persistence
- Kept `/trade` dense and readable in both themes, including the ticker bar, chart shell, order book, recent trades, order form, and bottom tabs
- Cleaned up hardcoded dark-mode surfaces across dashboard, wallet, markets, trade, orders, trades, ledger, and admin pages without changing backend behavior
- No matching logic, market-order behavior, fee logic, wallet rules, transfer rules, schema, deposit, withdraw, or blockchain behavior changed

## v0.18 AI-Native Project Docs / Codex Context Pack

v0.18 is a docs-first maintenance milestone. It adds an AI-native context pack for architecture state, business rules, API contracts, terminology, testing workflow, release workflow, UI style, event flow, current limitations, and known tech debt without changing product behavior.

## v0.17.4 Trading Interaction Polish

v0.17.4 improves live `/trade` interaction while keeping backend order execution behavior unchanged.

- Clicking an order book bid or ask fills the Limit price input and switches the form to Limit mode
- Clicking a recent trade price fills the Limit price input without placing an order
- Best Bid, Best Ask, and Last quick price buttons fill the current Limit price from existing ticker/order-book data
- Open Orders adds current-market Cancel All, Cancel Buy, and Cancel Sell controls for cancellable user limit orders
- Open orders use compact cards that show side, type, price, amount, filled, remaining, status, quote flow, and per-order cancel action
- Existing Limit and Market order behavior, matching logic, fee rules, wallet rules, transfer rules, schema, deposit, withdraw, blockchain integration, and order types are unchanged

## v0.17.3 Markets Sorting / Favorites Polish

v0.17.3 improves `/markets` discovery while keeping backend market data and trading behavior unchanged.

- `/markets` supports sorting by 24h volume, 24h change, last price, symbol, best bid, best ask, and newly listed
- Search covers market symbol, base asset, quote asset, asset names, and display names
- Quote-asset, status, and favorites-only filters compose with search and sorting
- Favorites are local-only, stored in `localStorage`, and can be toggled from market rows without navigating
- Overview sections show favorites, top gainers, top losers, trending markets, and newly listed markets in compact cards
- Full market rows are clickable exchange-style rows with pair icons, last price, 24h change, volume, bid/ask, paused status, favorite star, and Trade affordance
- No matching logic, market-order behavior, fee rules, wallet rules, schema, deposit, withdraw, blockchain integration, or new order types were changed

## v0.17.2 Portfolio / Asset Display Polish

v0.17.2 improves Dashboard and Wallet portfolio scanning while keeping backend trading and wallet behavior unchanged.

- Dashboard and Wallet asset displays now support sorting by estimated value, token amount, symbol, available balance, and locked balance
- Asset search works by symbol, name, and display name
- Hide-zero and hide-`< 1 SWC` controls keep larger portfolios readable while leaving unpriced assets visible
- Asset rows show icon, symbol, display name, available, locked, total, estimated price, and estimated SWC value without relying on horizontal scroll
- Assets with active related markets show a Trade link to `/trade?market=...`, preferring `BASE/SWC` markets when available
- No matching logic, market-order behavior, fee rules, wallet rules, schema, deposit, withdraw, blockchain integration, or new order types were changed

## v0.17.1 Smoke Idempotency / Local DB Test Stability

v0.17.1 makes local smoke checks repeatable against reused development databases.

- Smoke fee, matching, market-data, and market-order scenarios use per-run assets and markets where deterministic isolation matters
- Assertions are scoped to smoke-created users, orders, markets, and trades instead of global seeded-market state
- Repeated smoke runs no longer depend on the seeded `SWL/SWC` order book being empty
- No product behavior, API behavior, schema, matching logic, fee logic, wallet rules, or transfer rules were changed

## v0.14 K-line / Candlestick Chart

v0.14 adds a lightweight K-line chart generated from existing settled trade records.

- `GET /api/markets/candles?marketSymbol=SWL/SWC&interval=1m` returns OHLC candles for the selected market
- Supported intervals are `1m`, `5m`, `15m`, `1h`, and `1d`
- Candle open, high, low, close, base volume, quote volume, and trade count are computed from real trades
- Candles are market-specific and do not mix trades from different markets
- `/trade` includes a compact dark candlestick chart with interval controls
- Markets with no trades show: `No trades yet. K-line data will appear after trades execute.`
- No fake K-line data, fake prices, or seeded candles are generated
- v0.14 does not add market orders, deposit, withdraw, blockchain integration, or chain addresses

## v0.14.1 Exchange-style K-line Chart

v0.14.1 keeps the existing candle API and upgrades `/trade` to a desktop-first exchange-style interactive chart.

- Candles render with `lightweight-charts` instead of the earlier generated SVG-style chart
- The chart includes crosshair hover, right-side price scale, bottom time scale, and a lower volume pane
- Hover/default OHLC panel shows time, open, high, low, close, change, change %, volume, quote volume, and trade count
- Market and interval changes reload the same `/api/markets/candles` data path
- Empty markets still show: `No trades yet. K-line data will appear after trades execute.`
- No technical indicators, depth chart, market orders, deposit, withdraw, blockchain integration, or chain addresses are added

Optional local demo helper:

```bash
SW_EXCHANGE_ALLOW_SIMULATED_TRADES=local-demo-only corepack pnpm exec tsx scripts/seed-simulated-trades.ts
```

This helper is not part of normal `db:seed`, only runs with explicit opt-in, and refuses non-local database hosts.

## v0.17 Professional Trading Terminal Layout

v0.17 reshapes `/trade` into a denser professional centralized-exchange terminal while keeping backend trading behavior unchanged.

- `/trade` now uses a three-zone desktop terminal: flexible left workspace, fixed right order-entry rail, and bottom activity/history panel
- The top ticker bar keeps the market selector, last price, 24h change, 24h high/low, base volume, quote volume, bid, and ask in one compact strip
- The chart now dominates the left/center while order book and recent trades stay docked beside it
- Open Orders, Order History, Trade History, and Assets are docked below the chart workspace instead of pushing the order form downward
- The layout direction was informed by `docs/ui-references/bybit-trade-layout-summary.md`
- No matching logic, market-order behavior, fee rules, wallet rules, schema, deposit, withdraw, blockchain integration, or new order types were changed

## v0.16.3 Exchange Layout Polish

v0.16.3 removes the backend-table feel from core exchange pages while keeping trading behavior unchanged.

- Dashboard asset valuation is shown as compact rows/cards instead of a horizontally scrolling table
- `/markets` full market rows fit the page without internal horizontal scrolling
- `/trade` uses the market header space for selected-market context plus last price, 24h stats, volume, bid, and ask
- Trade market selector rows stay compact and avoid horizontal overflow
- Pair icon sizing remains consistent across market browsing and trade surfaces
- No deposit, withdraw, blockchain integration, chain addresses, stop-loss, take-profit, post-only, leverage, futures, or contracts are added

## v0.16.2 Exchange UI Polish

v0.16.2 tightens the exchange browsing and navigation experience while keeping trading behavior unchanged.

- `/markets` adds compact Top Gainers, Newly Listed, and Trending sections above the full market list
- Full market rows are clickable and open the selected market in `/trade`
- Trade navigation opens a hoverable market panel with quick spot-market discovery
- Market pair icons are kept clean and readable in trade, markets, and shared rows
- Dashboard tables scroll horizontally instead of clipping right-side columns
- No deposit, withdraw, blockchain integration, chain addresses, stop-loss, take-profit, post-only, leverage, futures, or contracts are added

## v0.16 Trading UX / Order Safety Polish

v0.16 keeps the existing spot-matching, fee, and wallet model intact while making `/trade` safer and more exchange-like.

- The native market select is replaced with a searchable exchange-style selector opened from the trade header
- LIMIT and MARKET orders now go through a lightweight confirmation step before submission
- `POST /api/orders/preview` also supports LIMIT-order confirmation metadata without mutating balances
- Market orders show `FULL`, `PARTIAL`, or `NONE` liquidity status with clearer receive, average-price, fee, and trade-count estimates
- No-liquidity market orders are blocked earlier in the `/trade` flow
- Quick-fill `25%`, `50%`, `75%`, `100%`, and `Max` controls help size limit and market orders from displayed balances
- User and admin order-history tables now make LIMIT vs MARKET outcomes, average price, quote flow, and cancelled remainder easier to read
- No deposit, withdraw, blockchain integration, chain addresses, stop-loss, take-profit, post-only, leverage, futures, or contracts are added

## v0.15 Market Orders / Taker Flow

v0.15 adds exchange-style market orders for all seeded and admin-created spot markets.

- `POST /api/orders` accepts `type: "LIMIT" | "MARKET"`
- `POST /api/orders/preview` estimates market-order fills from the current order book without mutating balances
- Market Buy uses a quote spend input such as `quoteAmount: "100"` and consumes the lowest asks first
- Market Sell uses a base amount input such as `amount: "50"` and consumes the highest bids first
- Same-price liquidity follows earliest-created order priority
- Trade price is always the resting maker order price
- Market orders execute immediately, keep executed fills, cancel any unfilled remainder, and never rest on the order book
- Partial market fills end as `PARTIAL_FILLED_CANCELLED`
- No-liquidity market orders return `NO_LIQUIDITY` without balance or trade mutation
- Buyer fees remain charged in base asset and seller fees remain charged in quote asset
- No deposit, withdraw, blockchain integration, chain addresses, stop-loss, take-profit, post-only, fill-or-kill, leverage, futures, or contracts are added

## v0.13 Admin Asset / Market Creation

v0.13 lets admins list new virtual assets and new spot markets manually without any blockchain integration.

- `POST /api/admin/assets` creates a virtual asset with manual metadata, status, and audit logging
- New assets eagerly create zero-balance `MAIN` wallets for existing users and zero-balance admin `MAIN`/`FEE`/`TREASURY`/`AIRDROP`/`HOT` wallets idempotently
- `POST /api/admin/markets` creates a new `BASE/QUOTE` spot market with optional precision and minimum settings
- New markets get default fee settings automatically and appear in `/markets`, `/trade`, ticker, order book, matching, trades, fees, and valuation flows
- `/admin/assets` now includes a create form while keeping metadata editing and asset status controls
- `/admin/markets` lists existing markets, shows last price when available, and lets admins create or pause/resume markets
- `/admin/fees` can manage fee settings per market instead of only the seeded default pair
- `/assets` lists all internal simulation assets
- No fake prices, fake trades, seeded order books, chain metadata, deposit, withdraw, or blockchain integration are added

See [docs/ROADMAP.md](docs/ROADMAP.md), [docs/VERSION_HISTORY.md](docs/VERSION_HISTORY.md), [docs/ACCOUNT_MODEL.md](docs/ACCOUNT_MODEL.md), and [docs/FUTURE_ROADMAP.md](docs/FUTURE_ROADMAP.md) for milestone planning, released history, the current wallet bucket model, and future product direction.

## v0.12 Multi-Market Foundation

v0.12 makes market-dependent exchange behavior use the selected market instead of assuming only `SWL/SWC`.

- Existing `SWL/SWC` behavior remains supported
- Seed adds demo asset `SWD` / `SW DOGE` and market `SWD/SWC`
- `GET /api/markets/summary` returns all seeded markets with base/quote asset metadata, last price, best bid/ask, 24h volume, quote volume, and change
- `GET /api/markets/ticker?marketSymbol=...`, `GET /api/order-book?marketSymbol=...`, and `GET /api/trades/recent?marketSymbol=...` are market-specific
- `POST /api/orders` uses the selected market's base and quote assets for locking, matching, trades, fees, and asset/market pause checks
- Matching only considers orders in the same market
- `/trade` defaults to `SWL/SWC` and includes a seeded-market selector
- `/markets` lists all seeded markets and links to `/trade?market=...`
- `/orders`, `/trades`, `/admin/orders`, and `/admin/trades` support market filtering
- Existing users receive missing active-asset MAIN wallets idempotently; admin receives missing active-asset bucket wallets idempotently
- Portfolio valuation remains SWC-based: `SWC = 1`, other assets use their latest `*/SWC` market price when one exists, otherwise valuation is pending
- Admin market/asset status pages display all seeded markets/assets
- Admin asset creation, admin market creation, K-line, market orders, deposit, withdraw, blockchain integration, and chain addresses are not implemented

## v0.11 Asset Metadata + Icon System

v0.11 adds asset display metadata and reusable icon rendering without changing matching, fees, transfers, wallet buckets, or status-control rules.

- Assets now support nullable `displayName`, `iconUrl`, `iconSource`, `sortOrder`, and `description` metadata
- `GET /api/assets` includes metadata for frontend and admin use
- `PATCH /api/admin/assets/:symbol/metadata` lets admins edit display name, icon URL, description, and sort order
- Metadata edits write `UPDATE_ASSET_METADATA` admin audit logs
- SWC and SWL are seeded/backfilled with display names and simulation descriptions without resetting balances
- The web app uses a shared `AssetIcon` fallback/avatar component across wallet, dashboard, markets, trade, ledger, fees, and admin asset views
- Known public icon mapping is local/static and admin `iconUrl` takes precedence
- Upload is deferred as future polish; manual icon URL is the v0.11 control
- No multi-market, K-line, market order, deposit, withdraw, blockchain, chain address, admin asset creation, or admin market creation behavior is implemented

## v0.10 Market Data + Portfolio Valuation

v0.10 adds market ticker data and SWC-denominated portfolio valuation without changing matching, fees, transfer rules, wallet buckets, or status controls.

- `GET /api/markets/ticker?marketSymbol=SWL/SWC` returns last price, best bid, best ask, 24h high/low/volume/quote volume/change, 24h trade count, and updated time
- `GET /api/markets/summary` returns a market-summary array shaped for future multi-market support
- `GET /api/wallets/me/valuation` returns total equity in `SWC` and per-asset available, locked, total, price, and value
- `SWC` is valued at `1 SWC`; `SWL` uses the latest real `SWL/SWC` trade price
- If no SWL/SWC trade exists, SWL valuation remains pending and no fake SWL price is shown
- `/trade` shows the ticker strip with last price, 24h change, 24h high/low/volume, best bid, and best ask
- `/markets` shows the SWL/SWC market table with ticker values and status
- `/dashboard` shows total equity, SWC balance/value, SWL balance/value, and pending valuation copy when no last price exists
- `/wallet` includes estimated SWC value where pricing is available
- `/admin` includes a market summary for last price, 24h volume, open orders, and total trades
- No K-line, market orders, multi-market creation, deposit, withdraw, blockchain integration, chain addresses, admin asset creation, or admin market creation is implemented

## v0.9 Ledger / Audit / Reports Polish

v0.9 improves data inspection without changing core exchange behavior.

- `/ledger` now shows a cleaner ledger table with time, type, asset, amount, after-balances, reference, note, positive/negative amount styling, and asset/type filters
- `/admin/ledger` now shows owner, role, wallet type, asset, type, after-balances, reference, note, and filters for user/email, asset, type, and wallet type
- Admin wallet bucket ledger entries are labeled as admin bucket activity instead of normal user-to-user transfers
- `/admin/audit-logs` now includes action/target filters, action badges, summaries, and expandable formatted before/after JSON
- `/admin` now uses `GET /api/admin/reports/summary` for report cards and recent trades, transfers, and audit logs
- Client-side CSV export is available for admin ledger, audit logs, trades, and transfers
- This milestone does not change matching, fee calculation, transfer rules, wallet bucket behavior, user/asset/market status rules, or chain behavior
- Deposit, withdraw, blockchain integration, chain addresses, market orders, futures/leverage, and K-line charts remain future work

## v0.8 Admin Controls + User Status Management

v0.8 adds operational controls for accounts, assets, and the single `SWL/SWC` market.

- User statuses are `ACTIVE`, `FROZEN`, and `BANNED`
- `FROZEN` users can login and view dashboard, wallet, ledger, orders, and trades
- `FROZEN` users cannot transfer, place orders, cancel orders, or trade through matching
- `BANNED` users cannot login and existing banned sessions are rejected by authenticated API requests
- Transfer recipients and admin airdrop targets must be `ACTIVE`
- Assets can be paused; paused assets cannot be transferred, airdropped, or used for new orders
- The `SWL/SWC` market can be paused; paused markets block new orders and matching
- Active users may still cancel existing open orders while the market is paused so they can unlock funds
- Status changes write `UPDATE_USER_STATUS`, `UPDATE_ASSET_STATUS`, and `UPDATE_MARKET_STATUS` admin audit logs
- No deposit, withdraw, blockchain, chain address, market order, futures, leverage, or K-line behavior is implemented

## v0.7.1 Admin Wallet Buckets / Wallet Model Polish

v0.7.1 represents platform balances as wallet buckets owned by the configured admin user. No separate active `FEE_ACCOUNT`, `TREASURY_ACCOUNT`, `AIRDROP_ACCOUNT`, or `HOT_WALLET_ACCOUNT` users are required.

- Normal users have `MAIN` wallets only
- The admin user has `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, and `HOT` buckets for `SWC` and `SWL`
- `/admin/wallets` separates the admin `MAIN` wallet from platform system wallet buckets
- Normal transfers are always `MAIN` to `MAIN`
- Admin bucket transfers are internal, free, admin-only moves between the admin user's own buckets
- To send system funds to a user, move funds from a system bucket to admin `MAIN`, then use a normal transfer from admin `MAIN` to user `MAIN`
- The `AIRDROP` bucket is a placeholder; current airdrops remain unlimited and do not debit it
- The `HOT` bucket is a future v1.x chain wallet placeholder; no blockchain, deposit, or withdraw logic is implemented

## v0.7 Admin Fee System + Fee Settlement

### API

- `GET /api/admin/fee-settings`
- `PATCH /api/admin/fee-settings`
- `POST /api/admin/fee-settings`

Only the `SWL/SWC` market is enabled. Fee rates are stored as integer basis points: `10 bps = 0.1%`, `100 bps = 1%`, and `10000 bps = 100%`. v0.7 enforces a 5% safety cap and rejects negative values, scientific notation, invalid decimal strings, and percent values with more than two decimal places.

Fees are calculated with bigint minimal-unit math and floor-rounded toward zero: `fee = amount * fee_bps / 10000`. Buyer fees are charged from received `SWL`; seller fees are charged from received `SWC`. Collected fees credit the admin user's `FEE` wallet bucket, not the admin `MAIN` wallet and not a separate system user.

Trade rows persist the actual buyer/seller fee amounts, fee asset IDs, and fee rates used at execution time. Historical trades keep those values even if admin fee settings change later.

### Web

- `/admin/fees` shows current fee settings, admin Fee Wallet balances, and an update form
- `/admin/wallets` shows the admin MAIN wallet separately from platform wallet buckets
- `/admin/audit-logs` includes `UPDATE_FEE_SETTINGS`
- `/trades` shows the current user's fee per fill
- `/admin/trades` shows buyer and seller fees
- `/ledger` and `/admin/ledger` render `FEE` entries as trading fees or fee income

## v0.6 Matching Engine + Trades + WebSocket Sync

### API

- `POST /api/orders` now attempts matching immediately after order creation
- `GET /api/trades/recent?marketSymbol=SWL/SWC`
- `GET /api/trades/me`
- `GET /api/admin/trades`

Only the `SWL/SWC` market is enabled. Matching uses price priority first and time priority second. Incoming BUY orders match resting SELL orders priced at or below the buy limit, consuming the lowest sell prices first. Incoming SELL orders match resting BUY orders priced at or above the sell limit, consuming the highest buy prices first. Trades execute at the resting maker order price.

Order creation, matching, wallet settlement, order state updates, trade creation, and ledger entries run in one database transaction. Partial fills keep the remaining amount open; filled and cancelled orders are excluded from the order book. Crossed orders from different users execute automatically. Crossed orders from the same user are skipped to prevent self-trading.

v0.6 did not charge trading fees. Fee settlement is live starting in v0.7.

### Web

- `/trade` shows the order book, recent trades, open orders, wallet balances, and limit order entry
- `/trade` refreshes data after order placement/cancellation and uses lightweight 5-second polling while open
- `/trades` shows the current user's settled fills
- `/admin/trades` shows all settled fills for admin review
- Trade and ledger pages are extended in v0.7 to show persisted fees

## Stack

- Monorepo with `pnpm`
- API: NestJS + TypeScript
- Web: Next.js + TypeScript + Tailwind CSS
- Database: PostgreSQL
- ORM: Drizzle ORM
- Local DB: Docker Compose

## Repo structure

```text
apps/
  api/        NestJS backend
  web/        Next.js frontend for user pages and admin pages
packages/
  shared/     shared constants and types
drizzle/      generated SQL migrations
```

## v0.5 Limit Order + Order Book

### API

- `POST /api/orders`
- `GET /api/orders/me`
- `POST /api/orders/:id/cancel`
- `GET /api/order-book?marketSymbol=SWL/SWC`
- `GET /api/admin/orders`

Only the `SWL/SWC` market is enabled. Limit BUY orders lock `SWC` equal to `price * amount`; limit SELL orders lock `SWL` equal to `amount`. Order creation, wallet lock movement, and the `ORDER_LOCK` ledger entry run in one database transaction. Cancelling an open order unlocks the remaining locked balance and writes an `ORDER_UNLOCK` ledger entry. v0.5 intentionally does not match orders, execute trades, create trade rows, or deduct fees.

### Web

- `/trade` places SWL/SWC limit orders, shows the order book, and cancels open orders
- `/orders` shows user order history with cancel support for open orders
- `/wallet` reflects locked balances from open orders
- `/ledger` and `/admin/ledger` show order lock/unlock ledger entries
- `/admin/orders` shows all orders newest first
- `/admin` includes total open order count

## v0.4 Internal Transfer

### API

- `POST /api/transfers`
- `GET /api/transfers/me`
- `GET /api/admin/transfers`

Internal transfers are free and support only active `SWC` and `SWL`. The sender and recipient must both be `ACTIVE`; this intentionally blocks `FROZEN` and `BANNED` accounts from receiving for the safer/simple v0.4 rule. Transfer execution runs in one database transaction, moves only `available_balance`, leaves `locked_balance` unchanged, creates a transfer record, and writes paired `TRANSFER_OUT` / `TRANSFER_IN` ledger entries.

### Web

- `/transfer` executes internal transfers and shows personal transfer history
- `/wallet` links the Transfer action to `/transfer`; Deposit and Withdraw remain disabled
- `/admin/transfers` shows all internal transfers newest first
- `/admin` includes total transfer count
- `/ledger` and `/admin/ledger` show transfer ledger entries

## v0.3 Admin Airdrop + Wallet Viewer

### API

- `GET /api/wallets/me`
- `GET /api/ledger/me`
- `GET /api/admin/users`
- `GET /api/admin/wallets`
- `POST /api/admin/airdrop`
- `GET /api/admin/ledger`
- `GET /api/admin/audit-logs`
- `GET /api/admin`
- `GET /api/assets`

Admin airdrops can credit only active `SWC` or `SWL` assets. Each airdrop runs in one database transaction and updates the target wallet, creates a ledger entry, and creates an admin audit log together.

### Web

- `/wallet` shows real user balances
- `/dashboard` shows live SWC/SWL wallet balances
- `/ledger` shows real user ledger entries
- `/admin/users` shows real users without password hashes
- `/admin/wallets` shows real joined user wallet balances
- `/admin/airdrop` executes admin airdrops
- `/admin/ledger` shows real ledger entries
- `/admin/audit-logs` shows real admin audit logs

## v0.1 Foundation

### API

- NestJS app with modular structure:
  - `auth`
  - `users`
  - `assets`
  - `wallets`
  - `ledger`
  - `transfers`
  - `markets`
  - `orders`
  - `trades`
  - `admin`
- JWT auth
- Public registration
- Login with email or username
- Role model with:
  - `USER`
  - `ADMIN`
- Status model with:
  - `ACTIVE`
  - `FROZEN`
  - `BANNED`
- Health endpoint at `/api/health`
- Placeholder protected endpoints for future modules

### Web

- Next.js app-router frontend
- Tailwind-based initial route UI
- User routes:
  - `/login`
  - `/register`
  - `/dashboard`
  - `/wallet`
  - `/transfer`
  - `/trade`
  - `/orders`
  - `/trades`
  - `/ledger`
- Admin routes:
  - `/admin/login`
  - `/admin`
  - `/admin/users`
  - `/admin/wallets`
  - `/admin/airdrop`
  - `/admin/transfers`
  - `/admin/assets`
  - `/admin/orders`
  - `/admin/trades`
  - `/admin/ledger`
  - `/admin/audit-logs`

### Database

Implemented schema:

- `users`
- `assets`
- `wallets`
- `ledger_entries`
- `admin_audit_logs`
- `transfers`
- `markets`
- `orders`
- `trades`

Money-related fields are stored as exact PostgreSQL `numeric(78,0)` minimal units. JavaScript floating-point numbers are not used for balances or amount parsing.

## Seeded data

The seed script creates:

- Assets:
  - `SWC` / `SW Cash` / `18` decimals
  - `SWL` / `SW LUNA` / `18` decimals
- One admin user from environment variables:
  - `ADMIN_EMAIL`
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD`
- Admin wallets for both assets
- One market:
  - `SWL/SWC`

## Environment

For the API and shared root settings, copy the root example file:

```bash
cp .env.example .env
```

For the web app, create a local Next.js env file:

```bash
cp apps/web/.env.example apps/web/.env.local
```

If you run the API directly from `apps/api`, you can also create a package-local env file:

```bash
cp apps/api/.env.example apps/api/.env
```

Default example values:

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sw_exchange
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
ADMIN_EMAIL=admin@swexchange.local
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeMe123!
```

Notes:

- The API is served under the global `/api` prefix, so auth requests must target URLs like `http://127.0.0.1:3001/api/auth/login`.
- The API root `http://127.0.0.1:3001/` is expected to return `404` because `/api` is required.
- The web app is safest when opened on the same host family you configure for the API, for example `http://127.0.0.1:3000` with `http://127.0.0.1:3001/api`.

## Production-style local deploy

### 1. Create the production env file

```bash
cp .env.production.example .env.production
```

Change at least:

- `POSTGRES_PASSWORD`
- `DATABASE_URL` if you change the Postgres username, password, or database name
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

### 2. Build and start the Docker runtime

```bash
./scripts/deploy-local.sh
```

### 3. Verify the deployment

```bash
./scripts/verify-deploy.sh
```

Default URLs:

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/api/health`

Useful production-runtime commands:

```bash
pnpm deploy:local
pnpm deploy:verify
pnpm compose:prod:logs
pnpm compose:prod:down
docker compose -f docker-compose.prod.yml --env-file .env.production down -v
```

Notes:

- `docker compose -f docker-compose.prod.yml --env-file .env.production down -v` resets the local production Postgres volume and should only be used when you intentionally want a clean production-style demo reset.
- v0.x remains off-chain only. There is still no deposit, no withdraw, no blockchain integration, and no chain-address flow in this deployable runtime.

## Local setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Apply checked-in migrations

```bash
pnpm db:migrate
```

### 4. Seed initial data

```bash
pnpm db:seed
```

### 5. Start API and web

```bash
pnpm dev
```

Only run `pnpm db:generate` when schema work intentionally changes Drizzle definitions.

Services:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Health check: `http://localhost:3001/api/health`

Recommended local browser URLs:

- Web: `http://127.0.0.1:3000`
- API health: `http://127.0.0.1:3001/api/health`

## Useful scripts

```bash
pnpm dev
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm smoke
pnpm deploy:local
pnpm deploy:verify
```

## Smoke test

After the database is up and the API plus web app are already running, you can run:

```bash
pnpm smoke
```

Normal local verification sequence:

```bash
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm smoke
```

Notes:

- Smoke does not start the API or web server for you.
- Smoke is designed to be rerunnable against a reused local database.
- If Next.js gets stale, stop `pnpm dev`, remove `apps/web/.next`, and start the dev stack again before rerunning smoke.

It verifies:

- API health
- Seeded assets, market, admin user, and admin wallets
- Normal user registration
- Normal user login
- Authenticated `/auth/me`
- Admin login
- Admin airdrop execution
- User wallet balance mutation
- User and admin ledger entries
- Admin audit log entry
- Internal transfer balance movement and paired transfer ledger entries
- Limit order balance locking and unlocking
- User and admin order listing
- Order book grouped bid/ask levels
- ORDER_LOCK and ORDER_UNLOCK ledger entries
- Web build
- The current user and admin web routes responding without crashing

## Troubleshooting

### Browser `Failed to fetch` on login or register

Check the resolved API URL first:

- Expected local auth base: `http://127.0.0.1:3001/api`
- Expected auth endpoints:
  - `POST http://127.0.0.1:3001/api/auth/register`
  - `POST http://127.0.0.1:3001/api/auth/login`
  - `GET http://127.0.0.1:3001/api/auth/me`

Common local causes:

- The web app is opened on `127.0.0.1:3000` but the API CORS config only allows `localhost:3000`
- `NEXT_PUBLIC_API_URL` is missing from `apps/web/.env.local`
- The API is not running on port `3001`
- The request URL is missing the `/api` prefix

### Hydration warning on `/login` or `/register`

If the hydration diff shows attributes or nodes like:

- `data-sharkid`
- `data-sharklabel`
- `shark-icon-container`

those are not emitted by this repo. They are typically injected by browser extensions such as password managers or security helpers before React hydrates.

Retest with:

- Incognito / Private window
- Password manager extensions temporarily disabled
- Security or form-helper extensions temporarily disabled

If the warning disappears in that clean browser session, the remaining mismatch is extension-driven rather than a server/client render bug in the app code.

## Current limitations

This scaffold does not yet implement:

- Market order flow
- Deposit / withdraw
- Blockchain integration
- Complex RBAC
- Maker/taker tiers, VIP discounts, or withdrawal fee logic

The schema and module boundaries are prepared so those features can be added incrementally.
