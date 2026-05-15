# SW Exchange Version History

Current completed milestone: `v0.3 Admin Airdrop + Wallet Viewer`

Next milestone: `v0.4 Internal Transfer`

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

This release remains within the v0.3 boundary:

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
