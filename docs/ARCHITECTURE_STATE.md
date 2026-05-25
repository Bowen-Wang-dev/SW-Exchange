# Architecture State

Current milestone: `v0.18.3 Pre-v1 Stabilization / Release Candidate`

## Current Stack

- Monorepo: `apps/api`, `apps/web`, `packages/shared`
- API: NestJS 11, TypeScript, JWT auth, class-validator
- Web: Next.js 15 App Router, React 19, Tailwind CSS 4
- Data: PostgreSQL + Drizzle ORM
- Shared constants: `@sw-exchange/shared`
- Charts: `lightweight-charts`
- Local workflow: Docker Compose Postgres, `corepack pnpm`, scripted smoke

## Current Completed Milestones

- `v0.17 Professional Trading Terminal Layout`
- `v0.17.1 Smoke Idempotency / Local DB Test Stability`
- `v0.17.2 Portfolio / Asset Display Polish`
- `v0.17.3 Markets Sorting / Favorites Polish`
- `v0.17.4 Trading Interaction Polish`
- `v0.18 AI-Native Project Docs / Codex Context Pack`
- `v0.18.1 Light Mode / Theme Polish`
- `v0.18.2 Admin Operations / Risk Controls Polish`
- `v0.18.3 Pre-v1 Stabilization / Release Candidate`

## Current Supported Assets / Markets

- Seeded assets: `SWC`, `SWL`, `SWD`
- Seeded markets: `SWL/SWC`, `SWD/SWC`
- Admins can create additional internal assets and spot markets
- Current valuation logic is SWC-quoted only

## Current Trading Features

- Spot trading only
- Multi-market limit orders
- Multi-market market-order taker flow
- Order preview for LIMIT and MARKET
- Current-user order cancellation
- Current-market bulk cancel in UI via per-order cancel requests
- Order book, recent trades, ticker, candles, order/trade history

## Current Order Types

- `LIMIT`
- `MARKET`

## Current Market Data Features

- `GET /api/order-book`
- `GET /api/markets/ticker`
- `GET /api/markets/summary`
- `GET /api/markets/candles`
- Trade-derived 24h stats
- Best bid / best ask from open limit orders
- Candles computed from settled trades on demand

## Current Wallet Model

- Normal users: `MAIN` only
- Admin user: `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, `HOT`
- Balances split into `availableBalance` and `lockedBalance`
- New active assets eagerly create zero-balance wallet coverage for users and admin buckets

## Current User Status Model

- `ACTIVE`
- `FROZEN`
- `BANNED`

## Current Asset Status Model

- Asset status is effectively `ACTIVE` or `PAUSED` (`isActive` boolean in storage)

## Current Market Status Model

- `ACTIVE`
- `PAUSED`

## Current Admin Features

- Admin login and protected admin routes
- User status controls
- Asset pause/resume
- Asset metadata editing
- Asset creation
- Market pause/resume
- Market creation
- Fee settings review/update
- Admin airdrop
- Admin wallet bucket transfers
- Safer admin confirmations for high-impact actions
- Admin filtering/search on users, assets, markets, audit logs, and ledger
- Admin reports, ledger, trades, transfers, orders, audit logs

## Current UI State

- Dark-first exchange style with alternate Light mode
- Desktop-first terminal on `/trade`
- Compact ticker strip, dominant chart, adjacent order book / tape, fixed order rail
- Bottom trading activity tabs
- Portfolio and markets views are searchable and sortable
- Admin operations pages are filterable and use confirmation dialogs for high-impact actions
- Favorites on `/markets` are local browser state
- Theme preference is stored in `localStorage`
- Release-candidate polish is focused on copy alignment, route sanity, and stable empty states instead of new product scope

## Current System Constraints

- Internal simulation only
- Off-chain internal-accounting model only
- No deposit / withdraw / blockchain
- No real-money redemption or live KYC flow
- No real-time event bus; web UI uses polling and manual refresh paths
- No candle aggregation table; candles come from trades
- Transfers are normal-user/admin `MAIN` wallet flows only
- User-facing transfer form currently supports `SWC` and `SWL` only

## Current Milestone

- Current completed milestone: `v0.18.3 Pre-v1 Stabilization / Release Candidate`
- Next planned milestone: `v1.x Chain Gateway`
