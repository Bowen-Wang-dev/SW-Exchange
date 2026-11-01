# Event Flow

This document describes current live `v0.x` runtime flows only. Future chain deposit, withdrawal, and custody flows are planned in:

- [DEPOSIT_WITHDRAW_FLOW.md](./DEPOSIT_WITHDRAW_FLOW.md)
- [V1_CHAIN_GATEWAY_PLAN.md](./V1_CHAIN_GATEWAY_PLAN.md)
- [CHAIN_EVENT_INDEXING.md](./CHAIN_EVENT_INDEXING.md)

## Limit Order Flow

- User submits `LIMIT` order -> API validates user / market / asset status -> amount and price are parsed -> minimums checked
- `BUY` -> quote is locked in `MAIN`
- `SELL` -> base is locked in `MAIN`
- `ORDER_LOCK` ledger entry is written
- Matching checks same-market opposite-side active-user limit orders
- Fills execute at resting maker price
- Order becomes `OPEN`, `PARTIAL_FILLED`, or `FILLED`

## Market Order Flow

- User submits `MARKET` order -> API validates user / market / asset status
- `MARKET BUY` -> requested quote spend is parsed from `quoteAmount` or `spendAmount`
- `MARKET SELL` -> requested base amount is parsed from `amount`
- Matching walks resting same-market limit liquidity
- Executed fills settle immediately
- No fill -> `NO_LIQUIDITY`
- Partial fill -> order ends `PARTIAL_FILLED_CANCELLED`
- Market orders never rest on the book

## Fee Settlement Flow

- Trade settles -> buyer fee computed in base asset -> seller fee computed in quote asset
- User fee ledger entries are written with type `FEE`
- Admin `FEE` wallet bucket is credited
- Admin fee-income ledger entries are written

## Internal Transfer Flow

- User submits `/api/transfers` -> sender and recipient resolved
- Sender must be `ACTIVE`
- Recipient must be `ACTIVE`
- Asset must be active and currently must be `SWC` or `SWL`
- Sender `MAIN.available` decreases -> recipient `MAIN.available` increases
- Transfer row + paired `TRANSFER_OUT` / `TRANSFER_IN` ledger entries are written

## Admin Airdrop Flow

- Admin submits `/api/admin/airdrop`
- Target user must be `ACTIVE`
- Asset must be active
- Target `MAIN.available` increases
- Admin audit log is written
- `AIRDROP` ledger entry is written
- Admin `AIRDROP` bucket is not debited in current `v0.x`

## Admin Asset Creation Flow

- Admin submits `/api/admin/assets`
- Symbol uniqueness is checked
- Asset row is inserted
- Wallet coverage is created idempotently for all users and admin buckets
- `CREATE_ASSET` audit log is written

## Admin Market Creation Flow

- Admin submits `/api/admin/markets`
- Base and quote assets must exist
- Symbol must match `BASE/QUOTE`
- Active market creation requires both assets active
- Market row is inserted
- Default active fee setting is bootstrapped
- `CREATE_MARKET` audit log is written

## User Status Change Flow

- Admin patches `/api/admin/users/:id/status`
- Guard rails prevent disabling the only active admin
- User status updates
- `UPDATE_USER_STATUS` audit log is written

## Asset / Market Pause Flow

- Admin patches asset or market status
- Asset pause blocks transfers, airdrops, and new orders involving that asset
- Market pause blocks new orders and matching
- Existing open limit orders remain cancellable
- Audit log is written

## Feature Flag Read Flow

- Client requests `/api/feature-flags` or admin requests `/api/admin/feature-flags`
- API loads canonical flag definitions and current `feature_flags` table rows
- Missing rows fall back to seeded defaults
- Current effective state is returned with description, group, risk, and planned-milestone metadata
- Future protected flows should call backend `assertFeatureEnabled(...)` before continuing

## Security Event Logging Flow

- Login attempts call the auth service
- Successful login records `AUTH_LOGIN_SUCCESS`
- Rejected login records `AUTH_LOGIN_FAILED`
- Email verification requests create hashed single-use tokens and record `EMAIL_VERIFICATION_REQUESTED`
- Successful mail dispatch records `EMAIL_VERIFICATION_SENT`
- Token confirmation records `EMAIL_VERIFICATION_CONFIRMED`
- Invalid, expired, or reused token attempts record dedicated email verification failure events
- Current admin status, fee, airdrop, and bucket-transfer actions record security-focused events after the main action succeeds
- `security_events` complements existing admin audit logs; it does not replace ledger or audit records
- Event metadata is sanitized before storage so secrets, raw passwords, JWTs, OTP seeds, verification codes, and private keys are not written

## Email Verification Flow

- Authenticated user submits `/api/auth/email-verification/request`
- API invalidates older pending tokens for that user and purpose
- API stores a hash-only single-use token row with expiry, IP, and user-agent context
- Console/dev mail provider prints the verification link and raw token to application logs only
- User confirms through `/api/auth/email-verification/confirm` or `/verify-email?token=...`
- API verifies the token hash, expiry, single-use state, and current email match
- `users.email_verified_at` is set and pending verification tokens are consumed

## Sensitive Action Policy Flow

- Admin requests `/api/admin/security-actions`
- API returns the canonical sensitive-action matrix defined in shared constants
- The matrix is currently informational only in `v1.0.2`
- Admin RBAC and purpose-bound password/enrolled-factor reauthentication for role changes are implemented in v1.0.4; broader email and sensitive-action enforcement remains future work

## Candle / K-line Data Flow

- Client requests `/api/markets/candles`
- API loads settled trades for one market
- Trades are bucketed by interval
- OHLC, base volume, quote volume, and trade count are computed on demand
- Client chart renders the returned candle list

## Portfolio Valuation Flow

- Client requests `/api/wallets/me/valuation`
- API loads `MAIN` wallets
- `SWC` is valued at `1 SWC`
- Non-`SWC` assets look for latest real `*/SWC` last price
- Available + locked are included in total balance
- Unpriced assets remain visible and flagged as valuation-pending

## Market Favorites / localStorage UI Flow

- User toggles star on `/markets`
- Favorite symbols are stored in browser `localStorage`
- Market table and overview cards re-filter from local state
- No server mutation occurs

## Price Click-to-Fill UI Flow

- User clicks order-book price / recent trade / Best Bid / Best Ask / Last
- UI switches to `LIMIT` mode when needed
- UI fills the limit price input only
- No order is placed until explicit confirmation

## Cancel All Current-Market Orders UI Flow

- UI filters current-market open limit orders already loaded from `/api/orders/me?marketSymbol=...`
- User confirms scope: `ALL`, `BUY`, or `SELL`
- Frontend loops existing `POST /api/orders/:id/cancel`
- After the loop, UI refreshes trade data, balances, order book, and candles

## Administrative role change (v1.0.4)

1. Global admin guard authenticates live database identity/status/version and validates explicit handler permissions.
2. Authorized role manager supplies password plus fresh enrolled factor for a target and exact role set; server issues a five-minute purpose-bound hash-only proof.
3. PUT replacement takes the shared PostgreSQL administrative advisory lock and deterministically locks actor/target rows; rechecks current authority/session version.
4. Reject self changes, excess delegation, unknown roles and final-active-super-admin removal. Admin status mutations use the same lock/invariants.
5. Atomically consume proof, replace assignments/base identity, increment target authVersion, revoke target proofs/challenges, and persist ADMIN_ROLE_ASSIGNED/REMOVED and ADMIN_ROLES_UPDATED security events. Audit failure rolls back all protected changes.
6. Rejected administrative access, escalation and last-super-admin protection emit sanitized security events after rollback. Offline reviewed recovery emits ADMIN_ROLES_BOOTSTRAPPED.
7. UI refreshes assignments; target must log in again. New requests resolve current database authority, never stale client role claims. Ordinary account sessions and trading flows remain unchanged.

See [complete authorization inventory and rollout rules](./ADMIN_ROLE_PERMISSIONS.md).

## v1.0.4 review remediation boundaries

Role replacement resolves effective legacy target authority inside the shared lock and refuses configured fee-principal identity removal before consuming proof. Status suspension retains that principal's role/ownership while revoking its sessions. Complete reports enforce all six required scopes before querying any raw subsection. Every shared audit-context consumer records the socket peer instead of arbitrary forwarding headers. No matching, fee arithmetic, wallet transfer or settlement event flow changes.
