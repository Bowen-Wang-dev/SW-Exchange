# SW Exchange Version History

Current completed milestone: `v0.18.3 Pre-v1 Stabilization / Release Candidate`

Next milestone: `v1.x Chain Gateway`

## Upcoming plan

- `v1.x Chain Gateway`

## v0.18.3 Pre-v1 Stabilization / Release Candidate

This milestone stabilizes the current off-chain simulated exchange for pre-v1 release-candidate use without changing backend trading behavior.

### Highlights

- Aligned top-level docs and app-facing milestone/status copy to make `v0.18.3` the current completed milestone
- Clarified that v0.x remains off-chain, with no real deposit, withdraw, blockchain, chain-address, KYC, or fiat-redemption behavior
- Polished small route notices and empty states on user surfaces to reduce stale or misleading copy
- Clarified smoke/dev workflow expectations, including required running services, rerunnable local DB smoke, and stale `.next` cleanup
- Marked local `sample/` reference captures as local-only workflow artifacts
- Kept matching logic, fee logic, wallet rules, transfer rules, schema, API behavior, deposit, withdraw, and blockchain behavior unchanged

### Developer and operational notes

- This milestone is release stabilization and copy/workflow polish only
- No schema or migration change is required for v0.18.3

## v0.18.2 Admin Operations / Risk Controls Polish

This milestone improves admin safety, filtering, and operational clarity without changing backend trading behavior.

### Highlights

- Added confirmation dialogs for user status changes, asset status changes, market status changes, fee updates, large airdrops, and admin wallet bucket transfers
- Added admin search/filter polish across users, assets, markets, audit logs, and ledger review
- Clarified admin wallet bucket roles and improved dashboard/report readability
- Kept matching logic, fee logic, wallet rules, transfer rules, schema, API behavior, deposit, withdraw, and blockchain behavior unchanged

### Developer and operational notes

- This milestone is admin UI/product polish only
- No schema or migration change is required for v0.18.2

## v0.18.1 Light Mode / Theme Polish

This milestone adds a polished alternate light theme while keeping dark mode as the default professional trading experience.

### Highlights

- Added CSS theme tokens for page, panel, border, text, input, chart-shell, and semantic status surfaces
- Added a global Light / Dark toggle with `localStorage` persistence
- Updated `/trade`, `/dashboard`, `/wallet`, `/markets`, `/orders`, `/trades`, `/ledger`, and admin pages for light-mode readability
- Kept matching logic, fee logic, wallet rules, transfer rules, schema, API behavior, deposit, withdraw, and blockchain behavior unchanged

### Developer and operational notes

- This milestone is frontend theme/UI polish only
- No schema or migration change is required for v0.18.1

## v0.18 AI-Native Project Docs / Codex Context Pack

This milestone is a docs-first maintenance pass focused on AI coding stability, milestone continuity, regression prevention, and architecture consistency.

### Highlights

- Added `docs/ARCHITECTURE_STATE.md` as the current-state architecture snapshot
- Added canonical business rules, terminology, API contracts, event flow, testing rules, release workflow, UI style guidance, known tech debt, and limitation docs
- Added `docs/README.md` as a docs index and AI read-order guide
- Updated milestone copy to make `v0.18` the current completed milestone and keep the next milestone planned-only
- No product behavior, API behavior, schema, or migrations changed

### Developer and operational notes

- This milestone is documentation and project-maintenance only
- The docs are intended to improve long-context restoration for future Codex/AI tasks

## v0.17.4 Trading Interaction Polish

This milestone keeps order execution behavior unchanged while making `/trade` interactions feel closer to a real exchange terminal.

### Highlights

- Clicking an order book bid or ask fills the Limit price input and switches the form to Limit mode
- Clicking a recent trade price fills the Limit price input without submitting an order
- Best Bid, Best Ask, and Last quick price buttons fill the Limit price from existing ticker/order-book data
- Open Orders includes current-market Cancel All, Cancel Buy, and Cancel Sell controls for cancellable user limit orders
- Bulk cancel actions confirm before cancelling and refresh trade data, balances, order book, candles, and open orders afterward
- Open orders use compact card rows that show type, side, price, amount, filled, remaining, quote flow, status, and per-order cancel action
- No deposit, withdraw, blockchain integration, chain addresses, stop-loss, take-profit, post-only, leverage, futures, or contracts are added

### Developer and operational notes

- No schema or migration change is required for v0.17.4
- Matching logic, fee calculation, transfer rules, wallet rules, market-order behavior, and API behavior are intentionally unchanged
- Bulk cancellation uses the existing current-user order cancel endpoint from the frontend
- This milestone is a frontend trading interaction polish pass

## v0.17.3 Markets Sorting / Favorites Polish

This milestone keeps market data and trading behavior unchanged while making `/markets` feel more like an exchange market center.

### Highlights

- `/markets` now supports sorting by 24h volume, 24h change, last price, symbol, best bid, best ask, and newly listed
- Market search covers symbol, base/quote assets, asset names, and display names
- Quote-asset, status, and favorites-only filters compose with sorting and search
- Favorites are stored locally in `localStorage` with star buttons that do not trigger row navigation
- Compact overview sections cover Favorites, Top Gainers, Top Losers, Trending, and Newly Listed markets
- Full market rows are clickable exchange-style rows with pair icons, last price, 24h change, 24h volume, bid/ask, paused badge, favorite star, and Trade affordance
- No deposit, withdraw, blockchain integration, chain addresses, stop-loss, take-profit, post-only, leverage, futures, or contracts are added

### Developer and operational notes

- No schema or migration change is required for v0.17.3
- Matching logic, fee calculation, transfer rules, wallet rules, market-order behavior, and API behavior are intentionally unchanged
- Favorites and market display preferences are local browser state only
- This milestone is a frontend market discovery polish pass

## v0.17.2 Portfolio / Asset Display Polish

This milestone keeps wallet and trading behavior unchanged while making Dashboard and Wallet asset displays easier to scan as more assets are listed.

### Highlights

- Dashboard and Wallet now share sortable, searchable portfolio asset rows
- Sort options include estimated value, token amount, symbol, available balance, and locked balance
- Hide-zero and hide-`< 1 SWC` filters reduce clutter without hiding unpriced assets as dust
- Asset rows show icon, symbol, display name, available, locked, total, estimated price, estimated SWC value, and a Trade action when an active related market exists
- Portfolio summary cards call out total equity, visible non-zero balances, locked balances, priced assets, and pending valuations
- No deposit, withdraw, blockchain integration, chain addresses, stop-loss, take-profit, post-only, leverage, futures, or contracts are added

### Developer and operational notes

- No schema or migration change is required for v0.17.2
- Matching logic, fee calculation, transfer rules, wallet rules, market-order behavior, and API behavior are intentionally unchanged
- This milestone is a frontend portfolio display polish pass

## v0.17.1 Smoke Idempotency / Local DB Test Stability

This milestone makes local smoke checks repeatable against reused development databases.

### Highlights

- Smoke fee, matching, market-data, and market-order scenarios use per-run assets and markets where deterministic isolation matters
- Smoke assertions are scoped to smoke-created users, orders, markets, and trades
- The smoke suite avoids assuming global seeded-market balances, order books, or trade lists are empty
- Smoke was verified twice back-to-back against a reused local database

### Developer and operational notes

- No schema or migration change is required for v0.17.1
- Product behavior, API behavior, matching logic, fee calculation, wallet rules, and transfer rules are intentionally unchanged
- This milestone is a test/tooling stability pass

## v0.17 Professional Trading Terminal Layout

This milestone keeps trading behavior unchanged while reshaping `/trade` into a denser professional CEX-style terminal.

### Highlights

- `/trade` now uses a compact ticker bar, dominant chart, adjacent order book and recent trades, fixed desktop order-entry rail, and docked bottom activity tabs
- Chart, depth, tape, and order-entry controls remain visible together at normal desktop zoom instead of stacking into large vertical cards
- Core terminal information avoids full-page horizontal scrolling and uses contained panel scrolling instead
- The layout direction was informed by `docs/ui-references/bybit-trade-layout-summary.md`
- No deposit, withdraw, blockchain integration, chain addresses, stop-loss, take-profit, post-only, leverage, futures, or contracts are added

### Developer and operational notes

- No schema or migration change is required for v0.17
- Matching logic, fee calculation, transfer rules, admin wallet buckets, market-order behavior, and API behavior are intentionally unchanged
- This milestone is a frontend layout milestone only

## v0.16.3 Exchange Layout Polish

This milestone keeps trading behavior unchanged while removing horizontal-scroll-heavy layouts from core exchange pages.

### Highlights

- Dashboard asset valuation uses compact rows/cards instead of an internally scrolling table
- `/markets` keeps clickable full rows while fitting market, price, change, volume, bid, ask, and trade affordance into the page
- `/trade` promotes ticker stats into the top market header beside the selected market switcher
- The trade market selector panel remains compact, vertically scrollable, and avoids horizontal overflow
- Pair icon sizing remains consistent across trade, markets, and navigation surfaces
- No deposit, withdraw, blockchain integration, chain addresses, stop-loss, take-profit, post-only, leverage, futures, or contracts are added

### Developer and operational notes

- No schema or migration change is required for v0.16.3
- Matching logic, fee calculation, transfer rules, admin wallet buckets, API behavior, and market-order backend behavior are intentionally unchanged
- This milestone is a frontend layout polish pass

## v0.16.2 Exchange UI Polish

This milestone keeps trading behavior unchanged while polishing exchange discovery and market browsing.

### Highlights

- `/markets` adds compact Top Gainers, Newly Listed, and Trending sections above the full market table
- Full market rows are clickable and open the selected market in `/trade`
- Trade navigation opens a hoverable market discovery panel
- Market pair icons are cleaned up across trade and markets surfaces
- Dashboard tables scroll horizontally instead of clipping right-side columns
- No deposit, withdraw, blockchain integration, chain addresses, stop-loss, take-profit, post-only, leverage, futures, or contracts are added

### Developer and operational notes

- No schema or migration change is required for v0.16.2
- Matching logic, fee calculation, transfer rules, admin wallet buckets, and admin asset/market creation behavior are intentionally unchanged
- This milestone is primarily a frontend/user-flow polish pass

## v0.16 Trading UX / Order Safety Polish

This milestone keeps market-order matching, settlement, fees, and wallet behavior unchanged while making the trading terminal safer and easier to use.

### Highlights

- `/trade` replaces the native market select with an exchange-style searchable market selector in the header
- LIMIT and MARKET orders now use a confirmation step before placement
- `POST /api/orders/preview` now supports LIMIT-order confirmation metadata in addition to MARKET preview
- Market-order preview and confirmation now surface clearer `FULL`, `PARTIAL`, and `NONE` liquidity messaging
- Market orders now show clearer estimated receive, average price, fee, trade count, and execution-summary copy
- Quick-fill `25%`, `50%`, `75%`, `100%`, and `Max` controls help users size both limit and market orders
- User and admin order-history tables now show clearer MARKET vs LIMIT execution outcomes

### Developer and operational notes

- No schema or migration change is required for v0.16
- Matching logic, fee calculation, transfer rules, admin wallet buckets, and admin asset/market creation behavior are intentionally unchanged
- This milestone is primarily a frontend/user-flow polish pass with a small preview API extension for LIMIT-order confirmation

### Constraints kept in place

- No deposit or withdraw
- No blockchain integration
- No chain addresses
- No stop-loss, take-profit, post-only, leverage, futures, or contracts

## v0.15 Market Orders / Taker Flow

This milestone adds exchange-style market orders and taker flow while keeping the simulated spot exchange scope narrow.

### Highlights

- `POST /api/orders` now accepts `type: LIMIT | MARKET`
- Market Buy uses quote spend input and walks the lowest asks first
- Market Sell uses base amount input and walks the highest bids first
- Same-price fills keep earliest-created order priority
- Trade price uses the resting maker order price
- Market orders never rest on the order book and never appear as open/cancellable orders
- Fully executed market orders end as `FILLED`
- Partial market orders keep executed fills and end as `PARTIAL_FILLED_CANCELLED`
- No-liquidity market orders return `NO_LIQUIDITY` without balance or trade mutation
- `POST /api/orders/preview` estimates fills, average price, fees, trade count, and `FULL`/`PARTIAL`/`NONE` liquidity status

### Developer and operational notes

- Migration `drizzle/0009_tough_rogue.sql` adds the `MARKET` order type, `PARTIAL_FILLED_CANCELLED` status, and market-order quote/average-price fields on `orders`
- Market-order matching and settlement run in one database transaction
- Buyer fees remain charged in base asset and seller fees remain charged in quote asset
- Market Buy deducts only actual quote spent; unspent quote remains available
- Market Sell deducts only actual sold base; unsold base remains available
- Smoke coverage includes full fill, partial fill/remainder cancel, no liquidity, fee collection, and market isolation

### Constraints kept in place

- No deposit or withdraw
- No blockchain integration
- No chain addresses
- No stop-loss, take-profit, post-only, fill-or-kill, leverage, futures, or contracts

## v0.14.1 Exchange-style K-line Chart

This patch keeps the v0.14 candle API and upgrades the `/trade` chart area into a desktop-first exchange-style interactive K-line.

### Highlights

- `lightweight-charts` renders real candlesticks instead of the earlier generated SVG-style chart
- Lower volume pane uses the same candle response volume data
- Right-side price scale, bottom time scale, and crosshair hover are enabled
- Hover/default OHLC panel shows time, open, high, low, close, change, change %, volume, quote volume, and trade count
- Market and interval changes reload through the existing `/api/markets/candles` endpoint
- The no-trades empty state remains unchanged

### Developer and operational notes

- No API fields, schema, matching behavior, fee calculation, transfer rules, or admin listing behavior changed
- Decimal strings are parsed into numbers only for browser chart rendering and display
- Optional `scripts/seed-simulated-trades.ts` remains a local demo helper only; it is not part of normal `db:seed` and requires explicit opt-in

### Constraints kept in place

- No technical indicators
- No depth chart
- No market orders
- No deposit or withdraw
- No blockchain integration
- No chain addresses

## v0.14 K-line / Candlestick Chart

This milestone adds lightweight K-line/candlestick data and a compact chart for each market using existing settled trades.

### Highlights

- Candle endpoint at `GET /api/markets/candles?marketSymbol=SWL/SWC&interval=1m`
- Supported candle intervals: `1m`, `5m`, `15m`, `1h`, and `1d`
- Candle buckets include start time, end time, open, high, low, close, base volume, quote volume, and trade count
- `/trade` shows a dark CEX-style candlestick chart for the selected market
- Interval changes and market changes reload the chart
- The chart uses the existing polling refresh path so executed trades appear after refresh/reload
- Empty markets show the no-trades chart state

### Developer and operational notes

- Candles are computed on demand from the `trades` table; no candle table, migration, or background job was added
- Aggregation uses settled trades for the selected market only
- Price comparisons and volume sums use stored bigint minimal-unit values before formatting response decimals
- Candle responses are sorted oldest to newest for chart rendering
- `limit` defaults to `100` candles and is capped at `500`
- Smoke coverage checks candle fields, daily OHLC/volume aggregation, empty-market behavior, invalid interval rejection, and invalid market rejection

### Constraints kept in place

- No fake K-line data
- No market orders
- No deposit or withdraw
- No blockchain integration
- No chain addresses
- No technical indicators or TradingView-level chart complexity

## v0.13 Admin Asset / Market Creation

This milestone lets admins create new simulation assets and spot markets manually while reusing the existing multi-market matching, fees, ticker, and valuation foundation.

### Highlights

- Admin asset creation endpoint at `POST /api/admin/assets`
- Admin market creation endpoint at `POST /api/admin/markets`
- `/admin/assets` adds a create form while keeping metadata editing and asset pause/resume controls
- New `/admin/markets` page lists existing markets, shows last price when available, and supports market creation plus pause/resume
- New `/assets` page lists internal simulation assets
- `/admin/fees` can manage fee settings per market instead of only `SWL/SWC`
- Airdrop asset choices load from active assets rather than a hardcoded list
- New markets appear in `/markets`, `/trade`, ticker, order book, trades, matching, fees, and SWC valuation flows without fake trade data

### Developer and operational notes

- Migration `drizzle/0008_freezing_senator_kelly.sql` adds `markets.min_order_amount` and `markets.min_notional`
- New assets eagerly create zero-balance `MAIN` wallets for existing non-system users
- Admin users receive zero-balance `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, and `HOT` wallets for new assets idempotently
- New markets automatically receive default active fee settings
- Active market creation is rejected when either base or quote asset is paused; admins can create the market as `PAUSED` instead
- No chain metadata, fake prices, fake trades, or seeded order book entries are created for manual listings

### Constraints kept in place

- No K-line chart
- No market orders
- No deposit or withdraw
- No blockchain integration
- No chain addresses

## v0.12 Multi-Market Foundation

This milestone makes market-dependent exchange behavior use the selected market while preserving existing `SWL/SWC` behavior.

### Highlights

- Seeded demo asset `SWD` / `SW DOGE` and market `SWD/SWC`
- Market summary endpoint returns all seeded markets
- Ticker, order book, recent trades, order placement, matching, and trade settlement are market-specific
- Matching only considers open/partially filled orders in the same market
- BUY locks the selected market quote asset; SELL locks the selected market base asset
- Fees continue to use bigint minimal-unit math and are looked up per selected market setting
- `/trade` defaults to `SWL/SWC` and includes a seeded-market selector
- `/markets` lists all seeded markets and links to `/trade?market=...`
- User/admin orders and trades support market filtering
- Wallet and portfolio valuation handle additional seeded assets; unpriced non-SWC assets remain pending
- Admin asset and market status controls display all seeded assets/markets

### Developer and operational notes

- No schema migration was required; existing `markets`, `orders`, `trades`, and `fee_settings` already had market identifiers.
- Seed changes are idempotent and do not reset balances.
- Existing users receive missing active-asset `MAIN` wallets.
- Admin receives missing active-asset `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, and `HOT` bucket wallets.

### Constraints kept in place

- No admin asset creation
- No admin market creation
- No K-line chart
- No market orders
- No deposit or withdraw
- No blockchain integration
- No chain addresses

## v0.11 Asset Metadata + Icon System

This milestone adds asset display metadata and reusable icon rendering while keeping exchange behavior unchanged.

### Highlights

- Asset metadata columns for display name, icon URL, icon source, sort order, and description
- Seed/backfill metadata for `SWC` and `SWL`
- Public `GET /api/assets` response includes metadata
- Admin metadata update endpoint at `PATCH /api/admin/assets/:symbol/metadata`
- `/admin/assets` shows icons and metadata and lets admins edit display name, icon URL, description, and sort order
- Metadata changes create `UPDATE_ASSET_METADATA` admin audit logs
- Shared web `AssetIcon` fallback/avatar component
- Asset icons/fallbacks appear across wallet, dashboard, markets, trade, ledger, fees, and admin asset displays where practical
- Known icon mapping is local/static; manual admin icon URLs override mapped/default behavior

### Developer and operational notes

- Migration `drizzle/0007_asset_metadata.sql` adds nullable metadata fields and backfills SWC/SWL metadata.
- Existing balances, wallets, ledgers, orders, trades, fees, and markets are preserved.
- Upload is intentionally deferred; v0.11 supports manual icon URLs first.
- Matching price-time behavior, fee calculation, transfer rules, admin wallet bucket behavior, and user/asset/market status behavior were not changed.

### Constraints kept in place

- No multi-market trading
- No admin asset creation
- No admin market creation
- No K-line chart
- No market orders
- No deposit or withdraw
- No blockchain integration
- No chain addresses

## v0.10 Market Data + Portfolio Valuation

This milestone adds real market ticker data and SWC-denominated portfolio valuation while keeping exchange execution behavior unchanged.

### Highlights

- Market ticker endpoint at `GET /api/markets/ticker?marketSymbol=SWL/SWC`
- Market summary endpoint at `GET /api/markets/summary`
- Portfolio valuation endpoint at `GET /api/wallets/me/valuation`
- Best bid and best ask are derived from open limit orders
- Last price, 24h high, 24h low, 24h volume, 24h quote volume, 24h change, and 24h trade count are derived from settled trades
- `/trade` shows market, last price, 24h change, 24h high/low/volume, best bid, and best ask
- `/markets` shows SWL/SWC ticker values and market status
- `/dashboard` shows total equity in `SWC`, SWC balance/value, and SWL balance/value
- `/wallet` shows estimated value in `SWC` where pricing is available
- `/admin` shows last price, 24h volume, open orders, and total trades for SWL/SWC

### Developer and operational notes

- No schema migration was required.
- Financial calculations use bigint minimal-unit math; API responses expose human-readable decimal strings.
- `SWC` is valued at `1 SWC`.
- `SWL` uses the latest real `SWL/SWC` trade price.
- If no SWL/SWC trade exists, SWL valuation is pending and no fake price is emitted.
- 24h change compares last price to the closest trade at or before the 24h window, or the earliest trade inside the window when no earlier reference exists.
- Matching price-time behavior, fee calculation, transfer rules, wallet bucket behavior, and user/asset/market status behavior were not changed.

### Constraints kept in place

- No K-line chart
- No market orders
- No multi-market creation
- No admin asset creation
- No admin market creation
- No deposit or withdraw
- No blockchain integration
- No chain addresses

## v0.9 Ledger / Audit / Reports Polish

This milestone improves inspection and reporting ergonomics while keeping the existing exchange behavior unchanged.

### Highlights

- `/ledger` has a cleaner user ledger table with time, type, asset, amount, after-balances, reference, note, filters, and empty states
- `/admin/ledger` shows all recent ledger entries with owner, role, wallet type, asset, type, amount, after-balances, reference, note, and filters
- Admin wallet bucket entries are labeled as admin `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, or `HOT` wallet activity where available
- Fee income is easier to identify as admin `FEE` wallet activity
- `/admin/audit-logs` has action/target filters, action badges, summaries, and expandable formatted before/after JSON
- `/admin` has real report cards and recent trades, transfers, and audit logs
- `GET /api/admin/reports/summary` returns simple admin-only summary counts, fee wallet balances, and recent activity
- Client-side CSV export is available for `/admin/ledger`, `/admin/audit-logs`, `/admin/trades`, and `/admin/transfers`

### Developer and operational notes

- No schema migration was required.
- The reports endpoint uses straightforward counts and existing formatted recent-list data.
- Ledger creation, audit creation, matching, transfer execution, fee calculation, wallet bucket movement, and status-control write paths were not changed.

### Constraints kept in place

- No deposit or withdraw
- No blockchain integration
- No chain addresses
- No market orders
- No futures, contracts, or leverage
- No K-line chart

## v0.8 Admin Controls + User Status Management

This milestone adds operational controls for users, assets, and the single `SWL/SWC` market.

### Highlights

- Admin user status endpoint at `PATCH /api/admin/users/:id/status`
- Admin asset status endpoint at `PATCH /api/admin/assets/:symbol/status`
- Admin market status endpoint at `PATCH /api/admin/markets/:symbol/status`
- `/admin/users` shows status badges and freeze, unfreeze, ban, and unban actions
- `/admin/assets` shows asset pause/resume controls and a `SWL/SWC` market pause/resume control
- `/admin/audit-logs` displays `UPDATE_USER_STATUS`, `UPDATE_ASSET_STATUS`, and `UPDATE_MARKET_STATUS`
- Frozen users can login and view dashboard, wallet, ledger, orders, and trades
- Frozen users cannot transfer, place orders, cancel orders, or trade through matching
- Banned users cannot login, and existing banned sessions are rejected by authenticated API requests
- Paused assets block transfers, airdrops, and new orders involving that asset
- Paused markets block new orders and matching while keeping order book/history viewable
- Active users can still cancel existing orders while a market is paused so locked funds can unlock

### Developer and operational notes

- No schema migration was required because `users.status`, `assets.is_active`, and `markets.status` already existed.
- Transfer recipients and admin airdrop targets must be `ACTIVE`; v0.8 keeps the safer rule that frozen accounts cannot receive user transfers or admin airdrops.
- Matching skips resting orders owned by non-active users.
- Status changes write admin audit logs with before and after state plus the optional admin note.

### Constraints kept in place

- No deposit or withdraw
- No blockchain integration
- No chain addresses
- No market orders
- No futures, contracts, or leverage
- No K-line chart

## v0.7.1 Admin Wallet Buckets / Wallet Model Polish

This milestone makes platform balances explicit admin wallet buckets while keeping normal users on simple `MAIN` wallets.

### Highlights

- No separate active `FEE_ACCOUNT`, `TREASURY_ACCOUNT`, `AIRDROP_ACCOUNT`, or `HOT_WALLET_ACCOUNT` users are required
- Admin bucket types are `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, and `HOT`
- Normal users only have `MAIN` wallets
- Admin has `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, and `HOT` wallets for `SWC` and `SWL`
- Fee settlement credits the admin `FEE` wallet, not admin `MAIN`
- `/admin/wallets` separates Admin Wallet from System Wallets
- Admin bucket transfers are internal, free, and only move funds between the admin user's own buckets
- Normal transfers remain `MAIN` to `MAIN` only
- To send system funds to a user, move bucket funds to admin `MAIN`, then use normal transfer to user `MAIN`

### Developer and operational notes

- Migration `drizzle/0006_admin_wallet_buckets.sql` adds `wallet_type` and admin wallet bucket ledger types.
- Seed is idempotent and creates the admin buckets without resetting existing balances.
- The seed step migrates legacy `FEE_ACCOUNT` SWC/SWL balances into the configured admin `FEE` bucket when present.
- The `AIRDROP` bucket is a placeholder; current airdrops remain unlimited and do not debit it.
- The `HOT` bucket is a future v1.x chain wallet placeholder; no blockchain, deposit, or withdraw logic is implemented.

## v0.7 Admin Fee System + Fee Settlement

This milestone adds admin-controlled fee settings and settles buyer/seller trading fees when SWL/SWC limit orders match.

### Highlights

- Admin fee settings endpoint at `GET /api/admin/fee-settings`
- Admin fee update endpoint at `PATCH /api/admin/fee-settings` and `POST /api/admin/fee-settings`
- `/admin/fees` page shows buyer fee rate, seller fee rate, admin Fee Wallet balances, and an update form
- Default buyer fee and seller fee are `0.1%`
- Fee setting changes create `UPDATE_FEE_SETTINGS` admin audit logs
- Buyer fees are charged from received base asset `SWL`
- Seller fees are charged from received quote asset `SWC`
- The admin `FEE` wallet bucket receives collected fees
- Trade records persist fee amounts, fee asset IDs, and execution-time fee rates
- `/trades` shows the user's fee per fill
- `/admin/trades` shows buyer and seller fees
- `/ledger` and `/admin/ledger` render `FEE` entries clearly

### Developer and operational notes

- Fee rates use integer basis points: `10 bps = 0.1%`, `100 bps = 1%`, and `10000 bps = 100%`.
- v0.7 caps configured fees at `5%` for safety.
- Fee calculations use bigint minimal-unit math: `fee = amount * fee_bps / 10000`.
- Fee rounding truncates toward zero. Very tiny trades may produce a zero minimal-unit fee.
- Historical trades are not recalculated when fee settings change; the trade row stores execution-time fee amounts and rates.
- Migration `drizzle/0005_admin_fee_system.sql` adds `fee_settings`, `users.is_system`, and trade fee asset/rate columns.

### Constraints kept in place

This release remains within the v0.7/v0.7.1 boundary:

- No market orders
- No maker/taker tier system
- No user VIP levels
- No fee discounts
- No blockchain deposit or withdraw
- No futures, contracts, or leverage
- No K-line chart

## v0.6 Matching Engine + Trades + WebSocket Sync

This milestone enables automatic SWL/SWC limit order matching, trade records, trade history, and lightweight polling sync.

### Highlights

- Limit orders now match automatically when an eligible opposite-side order exists
- Matching uses price priority, then time priority
- Trades execute at the resting maker order price
- Partial fills and multi-order matching are supported
- Better-price refunds are applied for incoming BUY orders whose limit price is above the maker price
- Crossed orders from different users execute; crossed orders from the same user are skipped to prevent self-trading
- Filled and cancelled orders are excluded from the order book
- User trade history endpoint at `GET /api/trades/me`
- Recent trade endpoint at `GET /api/trades/recent?marketSymbol=SWL/SWC`
- Admin trade list endpoint at `GET /api/admin/trades`
- `/trade` refreshes order book, recent trades, open orders, and displayed balances after order placement/cancellation, with 5-second polling as the v0.6 sync fallback

### Developer and operational notes

- Order creation, matching, wallet settlement, order state updates, trade creation, and ledger entries run in one database transaction.
- Buyer and seller settlement uses bigint minimal-unit arithmetic; no JavaScript floating-point math is used for balances, prices, totals, or quote amounts.
- v0.6 writes `TRADE_BUY`, `TRADE_SELL`, `ORDER_LOCK`, and `ORDER_UNLOCK` ledger entries for trading flows.

### Constraints kept in place

This release remains within the v0.6 boundary:

- No trading fees are charged
- No fee ledger entries are created
- No admin fee settings
- No market orders
- No blockchain deposit or withdraw
- No K-line chart

## v0.5 Limit Order + Order Book

This milestone enables SWL/SWC limit order placement, cancellation, balance locking, and a live open-order book without matching or trade execution.

### Highlights

- Limit order endpoint at `POST /api/orders`
- User order history endpoint at `GET /api/orders/me`
- Cancel endpoint at `POST /api/orders/:id/cancel`
- Order book endpoint at `GET /api/order-book?marketSymbol=SWL/SWC`
- Admin order list endpoint at `GET /api/admin/orders`
- BUY orders lock `SWC` equal to `price * amount`
- SELL orders lock `SWL` equal to `amount`
- Order creation writes `ORDER_LOCK` ledger entries in the same transaction as wallet and order updates
- Order cancellation writes `ORDER_UNLOCK` ledger entries in the same transaction as wallet and order updates
- `/trade` now places real limit orders, shows the order book, and cancels open orders
- `/orders` shows user order history with cancel support
- `/admin/orders` shows all orders newest first
- Admin dashboard includes total open orders
- Smoke coverage extended for order lock/unlock, order book, ledger, admin order listing, and negative order cases

### Developer and operational notes

- Money parsing and `price * amount` use bigint minimal-unit arithmetic with no JavaScript floating-point math.
- The order schema now records `remaining_amount`, `locked_asset_id`, and `cancelled_at`.
- The existing market status enum remains `ACTIVE` / `PAUSED`; v0.5 treats only `ACTIVE` markets as placeable.

### Constraints kept in place

This release remains within the v0.5 boundary:

- No matching engine
- No automatic trade execution
- No trade rows
- No trading fees
- No market orders
- No futures, contracts, or leverage
- No blockchain deposit or withdraw
- No K-line chart

## v0.4 Internal Transfer

This milestone enables free user-to-user internal transfers for active SW Exchange accounts.

### Highlights

- Internal transfer endpoint at `POST /api/transfers`
- User transfer history endpoint at `GET /api/transfers/me`
- Admin transfer list endpoint at `GET /api/admin/transfers`
- Transfer execution moves only `available_balance`; `locked_balance` cannot be transferred
- Transfer records and paired `TRANSFER_OUT` / `TRANSFER_IN` ledger entries are written in one database transaction
- Frontend `/transfer` page now submits real SWC/SWL transfers and shows transfer history
- Wallet Transfer action links to `/transfer`; Deposit and Withdraw remain disabled
- Admin Transfers page and admin dashboard transfer count added
- Smoke coverage extended for transfer balance movement, ledger entries, and admin transfer listing

### Developer and operational notes

- Money parsing continues to use decimal strings converted to bigint minimal units with no floating-point math.
- Recipients must be `ACTIVE`. This blocks both `FROZEN` and `BANNED` accounts from receiving transfers for the safer/simple v0.4 rule.
- Successful transfers are persisted after validation; failed transfer attempts are rejected without transfer records.

### Constraints kept in place

This release remains within the v0.4 boundary:

- No limit orders
- No order book
- No matching engine
- No trades
- No market orders
- No blockchain deposit or withdraw
- No K-line chart
- No complex RBAC

## v0.3 Admin Airdrop + Wallet Viewer

This milestone makes wallets and ledger/audit accounting real for the first admin-controlled funding flow.

### Highlights

- User wallet endpoint at `GET /api/wallets/me`
- User ledger endpoint at `GET /api/ledger/me`
- Admin users, wallets, ledger, and audit log endpoints
- Admin airdrop endpoint at `POST /api/admin/airdrop`
- Transaction-safe airdrop writes wallet balance, ledger entry, and admin audit log together
- Exact decimal string money parsing and formatting helpers with no floating-point math
- Frontend wallet, dashboard, ledger, admin users, admin wallets, admin airdrop, admin ledger, admin audit logs, and admin assets pages now load real API data
- Smoke coverage extended for the v0.3 airdrop/accounting path

### Developer and operational notes

- Money columns now use `numeric(78,0)` minimal units so 18-decimal assets can hold practical balances such as `1000 SWC` exactly.
- `users.nickname` is persisted and returned for admin user review.
- `ensureWalletsForUser(userId)` remains safe to call repeatedly and initializes missing active `SWC`/`SWL` wallets.

### Constraints kept in place

This release remained within the v0.3 boundary:

- No internal transfer execution
- No limit orders
- No matching engine
- No trades
- No market orders
- No blockchain deposit or withdraw
- No K-line chart
- No complex RBAC

## v0.2 Auth + CEX UI Shell

This milestone delivers the first exchange-style authenticated product shell on top of the v0.1 foundation.

### Highlights

- Frontend authentication integrated with the existing NestJS auth API
- Dark, compact CEX-style web shell with top navigation and sidebar navigation
- Protected user and admin routes in the web app
- Exchange-style placeholder pages for dashboard, wallet, trade, orders, trades, ledger, and admin areas
- API URL normalization and improved local environment guidance
- Development CORS support for both `localhost` and `127.0.0.1`
- Extended smoke coverage for authenticated `/auth/me`

### User-facing scope

- Login page connected to backend auth
- Register page connected to backend auth
- Role-aware redirect after login
- Admin access gating in the frontend
- Simulated exchange layout for the single `SWL/SWC` market

### Developer and operational notes

- Local web env example added at `apps/web/.env.example`
- Local API env example added at `apps/api/.env.example`
- Root environment documentation updated for local development
- Troubleshooting notes added for browser `Failed to fetch` and extension-driven hydration warnings

### Constraints kept in place

This release remains within the v0.2 boundary:

- No airdrop execution
- No wallet balance mutation logic
- No transfer implementation
- No order placement or matching engine
- No market orders
- No blockchain deposit or withdraw
- No K-line chart

## v0.1 Foundation

Completed foundation work includes:

- Monorepo scaffold
- NestJS API
- Next.js web
- PostgreSQL + Drizzle
- Seed data for `SWC`, `SWL`, `SWL/SWC`, and admin
- Smoke script
- Placeholder routes
- Basic auth endpoints

This milestone established the base project structure, database schema, local development workflow, and initial authentication contract for future product milestones.
