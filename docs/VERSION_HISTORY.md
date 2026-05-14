# SW Exchange Version History

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
