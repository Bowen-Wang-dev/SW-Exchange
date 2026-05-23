# SW Exchange v0.x

SW Exchange v0.x is a lightweight web-first simulated crypto exchange for internal virtual assets.

Current completed milestone: `v0.15 Market Orders / Taker Flow`

Next milestone: `Future scope remains uncommitted`

This version is intentionally limited:

- No blockchain integration
- No deposit or withdraw
- No BSC integration
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
- Admin market summary card for last price, 24h volume, open orders, and total trades
- Asset metadata fields for display name, icon URL, icon source, sort order, and description
- Clean fallback asset icons across user and admin asset displays
- Admin asset metadata editing for display name, icon URL, description, and sort order
- Admin audit logs for asset metadata changes
- Seeded demo market `SWD/SWC` alongside existing `SWL/SWC`
- Market selector on `/trade`
- Market summary list includes all seeded markets
- Admin asset creation endpoint and `/admin/assets` form
- Admin market creation endpoint and `/admin/markets` form
- Eager zero-balance wallet coverage for new assets across existing users and admin buckets
- Default fee-setting bootstrap for newly created markets
- Public `/assets` directory for listed simulation assets
- Market Buy uses quote spend input and never locks unspent quote long-term
- Market Sell uses base amount input and only deducts executed sold base

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

- Current completed milestone: `v0.15 Market Orders / Taker Flow`
- Next milestone: `Future scope remains uncommitted`

## Planned milestones

- `v1.x Chain Gateway`

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

## Local setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Generate migrations

```bash
pnpm db:generate
```

### 4. Apply migrations

```bash
pnpm db:migrate
```

### 5. Seed initial data

```bash
pnpm db:seed
```

### 6. Start API and web

```bash
pnpm dev
```

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
```

## Smoke test

After the database is up and the API plus web app are running, you can run:

```bash
pnpm smoke
```

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
