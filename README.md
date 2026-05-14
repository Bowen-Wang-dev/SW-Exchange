# SW Exchange v0.x

SW Exchange v0.x is a lightweight web-first simulated crypto exchange for internal virtual assets.

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
- Free internal transfers
- SWL/SWC spot limit-order foundation
- Admin dashboard foundation

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

## Implemented foundation

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
- Tailwind-based placeholder UI
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

Money-related fields are stored as PostgreSQL `bigint` minimal units. JavaScript floating-point numbers are not used for balances.

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

Copy the example file:

```bash
cp .env.example .env
```

Default example values:

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sw_exchange
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
ADMIN_EMAIL=admin@swexchange.local
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeMe123!
```

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

## Useful scripts

```bash
pnpm dev
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Current limitations

This scaffold does not yet implement:

- Order matching engine
- Market order flow
- Deposit / withdraw
- Blockchain integration
- K-line chart
- Complex RBAC
- Full admin actions like airdrop execution, freeze/unfreeze, and trade settlement logic

The schema and module boundaries are prepared so those features can be added incrementally.
