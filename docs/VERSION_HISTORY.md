# SW Exchange Version History

Current completed milestone: `v0.5 Limit Order + Order Book`

Next milestone: `v0.6 Matching Engine + Trades + WebSocket Sync`

## Upcoming plan

- `v0.6 Matching Engine + Trades + WebSocket Sync`
- `v0.7 Admin Fee System + Fee Settlement`
- `v0.8 Ledger / Audit / Reports polish`
- `v1.x BSC deposit/withdraw, market orders, K-line`

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
