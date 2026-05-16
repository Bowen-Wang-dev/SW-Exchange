# SW Exchange v0.x

SW Exchange v0.x is a lightweight web-first simulated crypto exchange for internal virtual assets.

Current completed milestone: `v0.6 Matching Engine + Trades + WebSocket Sync`

Next milestone: `v0.7 Admin Fee System + Fee Settlement`

This version is intentionally limited:

- No blockchain integration
- No deposit or withdraw
- No BSC integration
- No KYC
- No market orders
- No candlestick / K-line chart
- No trading fees yet

Current scope:

- Public registration
- JWT login
- Internal wallets
- User wallet viewer
- User ledger viewer
- Admin user and wallet viewer
- Admin SWC/SWL airdrop flow
- User SWC/SWL internal transfer flow
- User and admin transfer history
- Admin ledger and audit log viewer
- SWL/SWC limit order placement and cancellation
- SWL/SWC automatic matching with price-time priority
- SWL/SWC trade recording and trade history
- SWL/SWC order book grouped by price
- User and admin order history
- User and admin trade history
- ORDER_LOCK and ORDER_UNLOCK ledger entries
- TRADE_BUY and TRADE_SELL ledger entries

## Milestone status

- `v0.1 Foundation` completed
- `v0.2 Auth + CEX UI Shell` completed
- `v0.3 Admin Airdrop + Wallet Viewer` completed
- `v0.4 Internal Transfer` completed
- `v0.5 Limit Order + Order Book` completed
- `v0.6 Matching Engine + Trades + WebSocket Sync` completed

- Current completed milestone: `v0.6 Matching Engine + Trades + WebSocket Sync`
- Next milestone: `v0.7 Admin Fee System + Fee Settlement`

## Planned milestones

- `v0.7 Admin Fee System + Fee Settlement`
- `v0.8 Ledger / Audit / Reports polish`
- `v1.x BSC deposit/withdraw, market orders, K-line`

See [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/VERSION_HISTORY.md](docs/VERSION_HISTORY.md) for milestone planning and released history.

## v0.6 Matching Engine + Trades + WebSocket Sync

### API

- `POST /api/orders` now attempts matching immediately after order creation
- `GET /api/trades/recent?marketSymbol=SWL/SWC`
- `GET /api/trades/me`
- `GET /api/admin/trades`

Only the `SWL/SWC` market is enabled. Matching uses price priority first and time priority second. Incoming BUY orders match resting SELL orders priced at or below the buy limit, consuming the lowest sell prices first. Incoming SELL orders match resting BUY orders priced at or above the sell limit, consuming the highest buy prices first. Trades execute at the resting maker order price.

Order creation, matching, wallet settlement, order state updates, trade creation, and ledger entries run in one database transaction. Partial fills keep the remaining amount open; filled and cancelled orders are excluded from the order book. Crossed orders from different users execute automatically. Crossed orders from the same user are skipped to prevent self-trading.

v0.6 does not charge trading fees. Buyer and seller trade fee columns remain zero, no fee ledger entries are created, and fee settlement is planned for v0.7.

### Web

- `/trade` shows the order book, recent trades, open orders, wallet balances, and limit order entry
- `/trade` refreshes data after order placement/cancellation and uses lightweight 5-second polling while open
- `/trades` shows the current user's settled fills
- `/admin/trades` shows all settled fills for admin review
- Trade and ledger copy explicitly states that fees arrive in v0.7

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

- Order matching engine
- Automatic trade execution
- Real-time order, trade, or book sync
- Trading fees
- Market order flow
- Deposit / withdraw
- Blockchain integration
- K-line chart
- Complex RBAC
- Trade settlement logic

The schema and module boundaries are prepared so those features can be added incrementally.
