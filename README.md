# SW Exchange v0.x

SW Exchange v0.x is a lightweight web-first simulated crypto exchange for internal virtual assets.

Current completed milestone: `v0.3 Admin Airdrop + Wallet Viewer`

Next milestone: `v0.4 Internal Transfer`

This version is intentionally limited:

- No blockchain integration
- No deposit or withdraw
- No BSC integration
- No KYC
- No market orders
- No candlestick / K-line chart

Current scope:

- Public registration
- JWT login
- Internal wallets
- User wallet viewer
- User ledger viewer
- Admin user and wallet viewer
- Admin SWC/SWL airdrop flow
- Admin ledger and audit log viewer
- SWL/SWC spot limit-order foundation only

## Milestone status

- `v0.1 Foundation` completed
- `v0.2 Auth + CEX UI Shell` completed
- `v0.3 Admin Airdrop + Wallet Viewer` completed
- `v0.4 Internal Transfer` next

- Current completed milestone: `v0.3 Admin Airdrop + Wallet Viewer`
- Next milestone: `v0.4 Internal Transfer`

See [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/VERSION_HISTORY.md](docs/VERSION_HISTORY.md) for milestone planning and released history.

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
- Market order flow
- Deposit / withdraw
- Blockchain integration
- K-line chart
- Complex RBAC
- Internal transfer execution, freeze/unfreeze, and trade settlement logic

The schema and module boundaries are prepared so those features can be added incrementally.
