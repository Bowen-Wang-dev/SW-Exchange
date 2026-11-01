# v1.0.4 Admin Role Permissions

Implemented November 1, 2026. The next planned milestone is **v1.1 Chain Asset Registry**; chain execution remains unimplemented.

## Identity and role registry

`users.role` remains the basic `USER`/`ADMIN` identity boundary. Only an ACTIVE, non-system ADMIN with a current JWT can enter administrative APIs. FROZEN administrators may use ordinary read APIs but cannot perform any admin operation. BANNED sessions remain rejected by JWT authentication.

The versioned registry lives in `packages/shared/src/admin-permissions.ts`. There are no wildcard grants and no API for creating arbitrary roles or editing permission definitions. A permission must appear in both the deployed role registry and its database mapping. Multiple assigned roles form a union. Effective authority also requires the ADMIN/non-system identity boundary; ordinary USER identities never receive legacy fallback.

| Role | Authority |
| --- | --- |
| `viewer` | 13 read permissions; no writes, including when the rollout flag is disabled |
| `operator` | Viewer permissions plus `users.manage`, `assets.manage`, `markets.manage`; ordinary user status only; no financial mutation or administrator management |
| `super_admin` | All 20 explicitly enumerated permissions, including financial mutations and `admin_roles.manage` |

Read permissions: `users.read`, `assets.read`, `markets.read`, `fees.read`, `wallets.read`, `reports.read`, `orders.read`, `trades.read`, `transfers.read`, `ledger.read`, `audit.read`, `feature_flags.read`, `admin_roles.read`.

Write permissions: `users.manage`, `assets.manage`, `markets.manage`, `fees.manage`, `wallets.manage`, `airdrops.execute`, `admin_roles.manage`.

Public asset and market reads remain public. Their read permissions describe admin UI capabilities, and do not make existing public resources private. Wallet ownership, fee collection, matching and accounting rules are unchanged. Assigning an administrative role does not move funds or assign ownership of another administrator's system buckets.

## Database and existing administrators

- `0015_luxuriant_bug.sql`: four tables (`admin_roles`, `admin_permissions`, `admin_role_permissions`, `user_admin_roles`), canonical registry/grants, seven security-event enum values and explicit legacy backfill.
- `0016_overconfident_prodigy.sql`: widens existing reauthentication purposes from 32 to 64 characters for full SHA-256 target/role binding. Existing 2FA purposes remain valid.
- Composite primary keys enforce unique role/permission and user/role pairs. All references have foreign keys, with indexes for reverse permission, reverse role and assignment-actor lookup. Assignment attribution is nullable for legacy/offline bootstrap and retains creation time.
- No historical migration is edited. No trading, wallet, order or settlement table is changed.

**One-time compatibility assumption:** before v1.0.4, every non-system `users.role='ADMIN'` account already held full administrative authority. Migration 0015 grants `super_admin` only to those existing accounts, including suspended admins, preserving their status. It never selects USER or system accounts. Existing administrator sessions retain equivalent authority; migration alone does not revoke them.

Before applying this migration in another environment, a trusted operator must review the existing non-system ADMIN account list and resolve misclassified accounts. This assumption preserves working legitimate administrators without guessing real account identifiers. No real identifiers or credentials are embedded in migrations.

For a fresh deployment, run the normal migrations and seed. The explicitly configured new seed administrator is created as ADMIN. It then requires reviewed offline bootstrap before enabling granular enforcement. Rerunning seed never promotes an existing USER, restores a suspended administrator, or recreates a removed role assignment.

## Bootstrap and recovery

From the repository root, with the intended DATABASE_URL configured securely:

```sh
corepack pnpm --filter @sw-exchange/api admin:bootstrap \
  --user-id <reviewed-existing-admin-uuid> \
  --confirm-reviewed-admin \
  --reason <review-or-incident-reference>
```

The target must already be ACTIVE, non-system and ADMIN. Ordinary accounts are refused. The command refuses an existing active super-admin unless `--recover` is explicitly supplied. Initial bootstrap and exceptional recovery use the same transaction/advisory lock as live mutations, retain existing roles, invalidate affected sessions/challenges/proofs and persist an `ADMIN_ROLES_BOOTSTRAPPED` CRITICAL event. A repeated already-complete bootstrap makes no change.

If all admin accounts are suspended or have lost their base ADMIN identity, a trusted database operator must first review and repair one known legitimate account in a controlled maintenance transaction, preserving its credentials and incrementing authVersion. Then run reviewed bootstrap. This is an offline incident procedure, never an unauthenticated HTTP route or automatic startup promotion. Keep the database credential restricted; direct database owners are outside application RBAC.

After bootstrap/recovery, log in again. Prefer provisioning a second reviewed super-admin before changing another super-admin's status or roles. Store the human operator/review reference in the reason; no passwords or authentication material belong there.

## Authorization and rollout

`AdminPermissionsGuard` is registered globally through `APP_GUARD`. It identifies `/admin` controllers/paths, explicit admin permission policies and ADMIN role metadata (including the legacy `/users` alias). It invokes Passport JWT authentication directly so `@Public()` cannot bypass the admin boundary. Existing controller JWT/ADMIN guards remain in place.

Every administrative handler must have method-level `@RequireAdminPermissions(...)` or `@AlwaysRequireAdminPermissions(...)`. Missing or empty policies reject with 403, even for super-admins and with the feature flag off. Unknown permission keys never match the registry. Unauthenticated/stale sessions return 401; authenticated accounts without authority return 403. The route inventory test enumerates real Nest controllers and verifies all 34 policies; it includes a deliberately unprotected test route to demonstrate default denial.

`enableAdminRolePermissions` remains **false by default**:

- Assigned roles always constrain their holders. A viewer stays read-only and an operator never acquires financial/role-management privileges by switching the flag off.
- When false, unassigned legacy ADMIN identities retain the prior operational boundary, except role management and administration of other administrators always require explicit `admin_roles.manage`.
- When true, unassigned administrators fail closed on granular permissions too.
- Unknown persisted role assignments cannot become legacy fallback access.
- Removing all roles changes the target's base role to USER. Switching the flag off cannot revive that removed administrator.

Before enabling the flag, check every legitimate admin has reviewed assignments and at least one super-admin is ACTIVE. Use a controlled database/configuration change; no general-purpose feature flag editor is exposed. Disabling the flag after activation restores operational access for orphaned/unassigned ADMIN identities, so review that population before rollback. Assigned roles, JWT/status checks, role management authorization and last-super-admin protections remain enforced.

## Role mutation protocol and session freshness

1. Read `/api/admin/roles`, `/permissions`, `/capabilities`, and `/users/:id/roles`.
2. POST `/api/admin/users/:id/roles/reauth` with `{ roles, password, code? }`. The actor needs real `admin_roles.manage` regardless of flag state. Enrolled 2FA requires a fresh TOTP or unused recovery code even with enable2FA disabled. Password/factor budgets reuse existing authenticated limits. Both durable counters complete before the user-row lock; each admitted role-proof attempt reserves the factor budget even without enrollment or with an incorrect password. Failures roll back neither counter. Enrollment, factor consumption and session freshness remain transactionally checked.
3. Receive a five-minute, hash-only proof. Its purpose binds the actor, exact target and sorted replacement role set using SHA-256. It cannot be obtained through the ordinary 2FA-purpose endpoint.
4. PUT `/api/admin/users/:id/roles` with `{ roles, reauthToken }`. An empty role array removes administrator access. Unknown/duplicate roles, permission injection and extraneous properties return 400.
5. A shared PostgreSQL transaction advisory lock serializes role changes, administrator status changes and offline bootstrap. Lock the actor/target rows in deterministic order; re-read actor status, live grants and authVersion under that lock. Consume the proof and update roles, base identity, authVersion, pending proofs/challenges and critical audit records atomically.

Self-role changes are prohibited, including self-escalation/demotion. A no-op role set requires and consumes fresh proof without unnecessary session invalidation. Actors cannot grant a role or manage an existing target whose authority exceeds their actual permissions. Target authority includes legitimate legacy fallback when enforcement is disabled, resolved through the same capability policy and transaction connection as the guard. Under enabled enforcement an unassigned legacy target has no granular authority. Assigned target scopes remain protected; ordinary USERs never receive fallback. Queued role changes recheck current target authority under the shared lock. Operators cannot suspend or reactivate administrators, including with the rollout flag off. Removing/demoting/suspending the last ACTIVE non-system super-admin is rejected. In concurrent reciprocal demotions or suspension/demotion races, the second transaction rechecks the actor and rejects stale authority.

Changed targets increment authVersion and lose outstanding login challenges and reauthentication records. Earlier JWTs return 401; a new login uses the current database identity/grants. Admin status changes also revoke sessions, so reactivation does not resurrect old sessions. Unrelated ordinary sessions are not invalidated. JWT role claims and browser capability caches are never the authority. Requests already authorized and executing before a demotion may finish; new requests are checked against live state. Role/status transactions additionally recheck under the shared lock.

Administrator status changes use the same effective-authority ceiling as role replacement, including for reactivation and unchanged-status requests. Under the shared advisory lock and target row lock, the transaction rechecks the actor's ACTIVE/non-system ADMIN identity, authVersion, explicit admin_roles.manage and live effective permissions, then compares assigned/effective target permissions. With enforcement disabled, legitimate legacy ADMIN fallback is included; with enforcement enabled an unassigned target has no fallback. USER targets continue to require users.manage only. A queued role promotion cannot let a later status mutation bypass the ceiling. Authorized status changes still invalidate sessions and preserve the separate last-super-admin and fee-principal rules.

## Configured fee-principal invariant (review remediation)

FeesService resolves the exact ADMIN_EMAIL account with base identity ADMIN and isSystem=false. LIMIT and MARKET fills depend on that existing identity, not on the number of other super-admins. Role replacement checks the locked target inside the shared protected transaction and returns **409 Conflict** if an empty role set would remove that configured principal's ADMIN identity. The rejection preserves assignments, balances, authVersion and the unconsumed proof. Last-active-super-admin protection remains a separate invariant.

Suspending or banning that human is still permitted through the existing authorized status endpoint when last-super-admin/self protections allow it: fee lookup deliberately does not depend on ACTIVE status. Status changes revoke sessions, retain the same fee principal and leave fee receipt available. Status DTOs cannot mutate role, email or system identity; no profile/email/deletion endpoint provides an alternative transition. Nonempty role reductions preserve ADMIN identity and can revoke high-impact administrative permissions without transferring fee ownership.

Changing ADMIN_EMAIL or fully offboarding the fee owner requires a reviewed maintenance procedure and an explicit ownership plan. A second super-admin is not an automatic replacement fee recipient. No balances, percentages, settlement formulas or principal ownership are migrated here. Future platform fee-principal separation remains technical debt.

## Complete-report isolation (review remediation)

The chosen policy is **Option A: all-or-nothing complete report**. GET /api/admin/reports/summary requires the six scopes in ADMIN_REPORT_PERMISSIONS before the handler runs. Missing any scope returns 403 and no report data is queried or returned. The existing complete response remains unchanged for authorized viewer/operator/super-admin clients. No permission grants are broadened.

| Report data | Required scope |
| --- | --- |
| Aggregate operational counters/public market summaries | reports.read |
| Raw recent audit records | audit.read |
| Fee-configuration/principal lookup | fees.read |
| Fee-wallet balances | wallets.read |
| Raw recent trades | trades.read |
| Raw recent transfers | transfers.read |

GET /api/admin remains the aggregate-only counters endpoint under reports.read. It does not expose raw audit records or financial balances. Assigned roles remain subject to the complete-report requirements in either flag state.

## Complete fee-settings permission boundary (second review)

GET /api/admin/fee-settings requires both **fees.read + wallets.read** because its complete response includes feeWallet.balances with available/locked raw amounts. PATCH and POST return the same complete shape and therefore require **fees.manage + fees.read + wallets.read**. The global guard checks all required scopes before invoking FeesService, including for an invalid market. The existing complete-report six-scope policy is retained. Shipped viewer/operator/super_admin grants and fully authorized response shapes are unchanged; no partial response is introduced. All wallet aliases retain wallets.read.

## Audit events

- `ADMIN_ROLE_ASSIGNED`, `ADMIN_ROLE_REMOVED`, `ADMIN_ROLES_UPDATED`: CRITICAL, actor/target plus nonsecret before/after role arrays, transactionally durable. Audit insertion failure rolls back role mutation, session invalidation and proof consumption.
- `ADMIN_ACCESS_DENIED`: rejected admin authentication/permission/status attempts; unauthenticated actor is null.
- `ADMIN_PRIVILEGE_ESCALATION_REJECTED`: rejected role changes, including self changes and authority ceilings.
- `ADMIN_LAST_SUPER_ADMIN_PROTECTED`: last-super-admin protection for role or status changes.
- `ADMIN_ROLES_BOOTSTRAPPED`: reviewed offline bootstrap/recovery, with operator reason.
- `SENSITIVE_ACTION_CONFIRMED`: successful purpose-bound role reauthentication.

The centralized audit context now uses only socket.remoteAddress, ignoring X-Forwarded-For, X-Real-IP and request.ip. With no socket peer, the address is unknown/null. No trusted reverse proxy is configured; enabling one later requires an explicit reviewed trust policy, never blanket forwarding-header trust. Existing consumers (role/status/configuration/login/email/2FA events) retain actor, target, user-agent and sanitized metadata behavior.

Use the existing sanitized `SecurityEventsService`; audit metadata never contains passwords, JWTs, TOTP/recovery codes or reauthentication tokens. Rejection logging remains best-effort, matching the existing system. Successful role mutation audits fail closed in the mutation transaction. Existing auth/security events remain unchanged.

## Complete administrative route inventory

All paths have `/api` prefix. Unless marked **always**, granular permission checks apply according to the rollout behavior above; basic admin authentication is unconditional.

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/admin` | reports.read |
| GET | `/admin/reports/summary` | reports.read + audit.read + fees.read + wallets.read + trades.read + transfers.read |
| GET | `/admin/users` | users.read |
| GET | `/users` (legacy ADMIN alias) | users.read |
| PATCH | `/admin/users/:id/status` | users.manage; ADMIN targets also always require admin_roles.manage |
| GET | `/admin/wallets` | wallets.read |
| GET | `/admin/wallet` | wallets.read |
| GET | `/admin/system-wallets` | wallets.read |
| POST | `/admin/wallet-buckets/transfer` | wallets.manage |
| POST | `/admin/airdrop` | airdrops.execute |
| POST | `/admin/assets` | assets.manage |
| PATCH | `/admin/assets/:symbol/status` | assets.manage |
| PATCH | `/admin/assets/:symbol/metadata` | assets.manage |
| POST | `/admin/markets` | markets.manage |
| PATCH | `/admin/markets/:symbol/status` | markets.manage |
| GET | `/admin/orders` | orders.read |
| GET | `/admin/trades` | trades.read |
| GET | `/admin/transfers` | transfers.read |
| GET | `/admin/ledger` | ledger.read |
| GET | `/admin/fee-settings` | fees.read + wallets.read |
| PATCH | `/admin/fee-settings` | fees.manage + fees.read + wallets.read |
| POST | `/admin/fee-settings` | fees.manage + fees.read + wallets.read |
| GET | `/admin/audit-logs` | audit.read |
| GET | `/admin/feature-flags` | feature_flags.read |
| GET | `/admin/feature-flags/:key` | feature_flags.read |
| GET | `/admin/security-events` | audit.read |
| GET | `/admin/security-events/:id` | audit.read |
| GET | `/admin/security-actions` | audit.read |
| GET | `/admin/capabilities` | admin_roles.read |
| GET | `/admin/roles` | admin_roles.read |
| GET | `/admin/permissions` | admin_roles.read |
| GET | `/admin/users/:id/roles` | admin_roles.read |
| POST | `/admin/users/:id/roles/reauth` | admin_roles.manage **always**, fresh password and enrolled factor |
| PUT | `/admin/users/:id/roles` | admin_roles.manage **always**, exact single-use proof |

## Frontend

`/admin/roles` displays current capabilities, available permissions, role descriptions and per-user assignments. Authorized super-admins select replacement roles, provide fresh authentication and review a confirmation before submission. Self changes are disabled, errors include clear API status/messages, and changing the target clears sensitive inputs. Passwords/codes/proofs are held only transiently in memory. Existing users UI shows role assignments; navigation and operational buttons use server capabilities, refreshed on focus and every 30 seconds. Light/dark variables and responsive layouts are retained. Frontend gating is for usability; the backend is authoritative.

## Verification and limitations

See [review remediation](./V1_0_4_REMEDIATION.md) and [v1.0.4 verification](./V1_0_4_VERIFICATION.md) for exact executed commands and results. Use dedicated local PostgreSQL test databases; both integration commands fail instead of skipping when isolation/configuration is missing.

Remaining work includes multi-party approval, mandatory admin MFA policy, operator-assisted factor recovery and stronger verification for non-role financial/configuration actions. Database-owner edits bypass application checks; operational access remains restricted. Account status protections and role assignments are live, while email-enforcement and other future sensitive-action policies remain planned. No blockchain, deposit, withdrawal, margin, futures or liquidation implementation is included.
