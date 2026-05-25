# Feature Flags Plan

High-risk or optional modules must be controlled by backend-enforced feature flags. Flags must never be treated as frontend-only visibility toggles.

## v1.0.0 Status

The foundation in this document is now implemented as a database-backed `feature_flags` table with seeded defaults, public/admin read endpoints, an admin visibility page, and a backend helper service that fails closed for unknown flags during enforcement.

Current implemented endpoints:

- `GET /api/feature-flags`
- `GET /api/feature-flags/:key`
- `GET /api/admin/feature-flags`
- `GET /api/admin/feature-flags/:key`

Current implementation notes:

- Editing is intentionally not exposed yet.
- All currently defined future/high-risk flags seed disabled by default in `v1.0.0`.
- `assertFeatureEnabled(...)` exists for future protected backend flows.
- Unknown flags return `404` on read endpoints and fail closed in enforcement helpers.

## Flag Principles

- Disabled flags must block both UI entry points and backend execution paths.
- Admin users must be able to see the effective state of relevant flags.
- Riskier modules should require multiple flags, not one broad switch.
- Audit logs should capture changes to security-sensitive flags.

## Planned Flags

### `enableDeposits`

- Purpose: allow deposit-related UI and backend credit workflow
- Default value: `false`
- Frontend effect: hide deposit entry points, funding copy, and deposit status views
- Backend enforcement: reject deposit-address issuance, deposit-detection crediting, and deposit APIs when disabled
- Admin visibility: show enabled/disabled state in admin operations or runtime config view
- Safety notes: enabling deposits should require chain gateway readiness and confirmation rules

### `enableWithdrawals`

- Purpose: allow withdrawal request creation and review paths
- Default value: `false`
- Frontend effect: hide withdrawal forms and withdrawal-history actions
- Backend enforcement: reject withdrawal creation, approval, and broadcast flows when disabled
- Admin visibility: show enabled/disabled state and require audit logging on changes
- Safety notes: should remain off until auth security, review controls, and hot wallet ops are ready

### `enableAutoWithdrawals`

- Purpose: allow policy-based automatic withdrawal release
- Default value: `false`
- Frontend effect: show or hide auto-release policy status and related copy
- Backend enforcement: forbid automatic approval/broadcast when disabled
- Admin visibility: show whether withdrawals are manual-only or auto-release capable
- Safety notes: auto-withdrawal is higher risk than basic withdrawal support and should stay off by default

### `enableManualWithdrawalReview`

- Purpose: require manual admin review before withdrawal execution
- Default value: `false` in `v1.0.0` because withdrawals are not implemented yet
- Frontend effect: show review-pending states and admin review queues
- Backend enforcement: keep withdrawal requests in review states until approved by allowed admins
- Admin visibility: prominently visible in withdrawal operations views
- Safety notes: this should remain on unless a later, lower-risk auto-withdraw policy is intentionally adopted

### `enableChainGateway`

- Purpose: master gate for chain-asset, deposit, withdrawal, and reconciliation modules
- Default value: `false`
- Frontend effect: hide chain-specific funding surfaces and chain asset metadata views
- Backend enforcement: reject chain registry, address issuance, deposit, withdraw, and reconciliation jobs when disabled
- Admin visibility: visible as a top-level platform capability flag
- Safety notes: turning this off should act as an emergency pause for chain-facing workflows

### `enable2FA`

- Purpose: allow TOTP 2FA enrollment and enforcement
- Default value: `false`
- Frontend effect: hide security setup screens and 2FA challenge prompts when disabled
- Backend enforcement: reject 2FA enrollment, removal, and enforcement hooks when disabled
- Admin visibility: show whether the platform supports 2FA and whether it is required for admins
- Safety notes: backend must not accept “2FA-protected” flows when the feature is globally off

### `enableEmailVerification`

- Purpose: allow email verification requirements for account and sensitive actions
- Default value: `false`
- Frontend effect: hide verification banners and verification-required notices when disabled
- Backend enforcement: do not mark verification as required or block flows on it when disabled
- Admin visibility: show whether verification is active for users and admins
- Safety notes: when enabled, sensitive actions should verify current email-verification state server-side

### `enableSupportTickets`

- Purpose: allow an optional operator-facing support workflow
- Default value: `false`
- Frontend effect: hide support ticket entry points and admin ticket views
- Backend enforcement: reject ticket creation and admin ticket actions when disabled
- Admin visibility: visible in admin tooling config
- Safety notes: keep separate from security and withdrawal approval flows

### `enableAdminRolePermissions`

- Purpose: turn on granular admin RBAC instead of simple admin/non-admin behavior
- Default value: `false`
- Frontend effect: hide unauthorized admin controls and role-management views
- Backend enforcement: check permission scopes on sensitive admin actions
- Admin visibility: show role assignments, effective scopes, and protected actions
- Safety notes: backend scope checks are mandatory; UI hiding alone is not acceptable

### `enableMarginTrading`

- Purpose: allow margin simulation modules
- Default value: `false`
- Frontend effect: hide margin balances, borrow, and leveraged position surfaces
- Backend enforcement: reject margin account, borrow, and leveraged trade actions when disabled
- Admin visibility: show that margin remains simulation-only and disabled by default
- Safety notes: not part of `v1.x`; planned only for optional `v2.x`

### `enableFuturesTrading`

- Purpose: allow perpetual/futures simulation modules
- Default value: `false`
- Frontend effect: hide futures markets, position panels, and contract-specific controls
- Backend enforcement: reject futures order placement and position actions when disabled
- Admin visibility: show futures capability separately from spot and margin
- Safety notes: not part of `v1.x`; planned only for optional `v2.x`

### `enableShorting`

- Purpose: allow short exposure within planned margin/futures simulation
- Default value: `false`
- Frontend effect: hide short-direction controls and short position views
- Backend enforcement: reject short-opening actions when disabled
- Admin visibility: show whether shorting is available in simulation environments
- Safety notes: should not be enabled without margin or futures modules and liquidation rules

### `enableLiquidation`

- Purpose: allow liquidation simulation for risky leveraged positions
- Default value: `false`
- Frontend effect: hide liquidation thresholds and liquidation events when disabled
- Backend enforcement: prevent liquidation jobs and liquidation state transitions when disabled
- Admin visibility: visible in risk controls and simulation config
- Safety notes: only relevant if leveraged modules exist; keep off by default

### `enableAdvancedOrders`

- Purpose: allow non-basic order types such as stop-loss, take-profit, or post-only
- Default value: `false`
- Frontend effect: hide advanced order-entry controls and advanced order tabs
- Backend enforcement: reject advanced order-type payloads and related matching logic when disabled
- Admin visibility: show whether spot trading is basic-only or advanced-order capable
- Safety notes: do not expose partial advanced-order UI without backend enforcement
