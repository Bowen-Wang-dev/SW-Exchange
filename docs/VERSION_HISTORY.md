# SW Exchange Version History

Current completed milestone: `v0.8 Admin Controls + User Status Management`

Next milestone: `v0.9 Ledger / Audit / Reports polish`

## Upcoming plan

- `v0.9 Ledger / Audit / Reports polish`
- `v1.x BSC deposit/withdraw, market orders, K-line`

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
