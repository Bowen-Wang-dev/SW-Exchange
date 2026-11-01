# v1.0.4 implementation and verification report

Date: November 1, 2026 (Australia/Sydney).

Updated after the second independent security review: [current remediation and exact verification evidence](./V1_0_4_REMEDIATION.md#second-review--current-implementation-and-results). Migration-generation/application entries from the original implementation remain historical; neither remediation adds a schema/migration. Current **68 RBAC + 31 authentication = 99 passing** tests supersede the first-review 53/29 and original 33-test RBAC baselines.
Starting branch: `main`; starting commit: `9826f05d5763c6ffb3bec6a39959229ea1526bfa`.
The original implementation started clean. The second remediation starts with **45 modified tracked files and 16 untracked files** containing v1.0.4 and the first remediation; all existing work is preserved. No commit, staging or push is performed.
Current milestone: **v1.0.4 Admin Role Permissions**.
Next planned milestone: **v1.1 Chain Asset Registry**.

## 1. Files changed

The second review changes seven code/test/shared files and seven documents, listed in the current remediation report. It moves durable role-proof limiter operations before user locking, reuses authentication transaction connections for flag reads, adds the fee-settings balance policy on GET/PATCH/POST, and adds legacy-aware status authority checks. Fifteen RBAC and two authentication regressions are added, and the last-super-admin status test is strengthened. The inventory at the end includes the pre-existing v1.0.4 work as well.

The complete source/document/migration inventory appears at the end of this report. Main additions are the shared role registry, `apps/api/src/admin-roles/`, reviewed bootstrap script, `/admin/roles` UI, two additive migrations and this verification/runbook documentation. Existing admin controllers, status management, authentication reauthentication, frontend capability gating and smoke coverage are extended in place.

## 2. Database schema and migrations

- `0015_luxuriant_bug.sql`: admin_roles, admin_permissions, admin_role_permissions, user_admin_roles; composite primary keys, foreign keys, reverse lookup indexes; seven security-event enum values; canonical roles/grants and explicit legacy ADMIN backfill.
- `0016_overconfident_prodigy.sql`: widens existing purpose storage from varchar(32) to varchar(64), accommodating full SHA-256 target/role binding while preserving 2FA purposes.
- New Drizzle snapshots and journal entries are included; existing applied migrations are unchanged.
- The real PostgreSQL migration check first applied 0000–0014 to a new dedicated test database, inserted ACTIVE/FROZEN legacy ADMIN, ordinary USER and system ADMIN fixtures, then applied 0015. Exactly the two non-system ADMIN fixtures received super_admin; status/base identity were preserved. The fixtures were then removed.
- All **17** migration journal timestamps and SHA-256 file hashes match each of the three databases after verification.
- Development retained **7 users and 63 trades** before and after additive migrations. It was not reseeded or smoke-tested. Test trading mutations were isolated in a separate database. No database/volume was reset or removed.

## 3. Final role and permission registry

- `viewer`: 13 read permissions, no mutations.
- `operator`: viewer plus users.manage, assets.manage, markets.manage; no financial writes or administrator management.
- `super_admin`: all 20 explicit permissions, including financial writes and admin_roles.manage; no wildcards.
- Read registry: users.read, assets.read, markets.read, fees.read, wallets.read, reports.read, orders.read, trades.read, transfers.read, ledger.read, audit.read, feature_flags.read, admin_roles.read.
- Write registry: users.manage, assets.manage, markets.manage, fees.manage, wallets.manage, airdrops.execute, admin_roles.manage.

## 4. Existing administrator migration strategy

Pre-v1.0.4 non-system ADMIN identities already had full authority. Migration 0015 preserves that authority as super_admin, including suspended accounts without reactivating them. USER and system accounts are excluded. This explicit assumption must be reviewed against the administrator roster before deploying elsewhere. No real account identifiers/credentials are hardcoded.

Fresh seeded administrators use the reviewed offline bootstrap command. Recovery requires explicit review/target/reason and `--recover` if an active super-admin exists. The command refuses ordinary/suspended/system targets, serializes with live admin changes, revokes affected sessions and records a CRITICAL event. Seed cannot silently undo demotion/suspension or recreate removed assignments. See [bootstrap/recovery instructions](./ADMIN_ROLE_PERMISSIONS.md#bootstrap-and-recovery).

## 5. Backend guard/decorator design

Global APP_GUARD identifies admin paths/controllers, ADMIN metadata and explicit permission policies. It invokes Passport directly, preserving the authentication boundary even if Public metadata is added accidentally. Existing JWT and role guards remain. Every handler needs method-level RequireAdminPermissions or AlwaysRequireAdminPermissions; missing/empty/unknown policies fail closed. Base identity, ACTIVE status, non-system status and current authVersion are checked server-side.

## 6. API authorization coverage

Complete report access now requires reports.read, audit.read, fees.read, wallets.read, trades.read and transfers.read before any report query. Aggregate-only GET /admin remains under reports.read. Twenty new semantic/regression tests exercise actual effects, partial grants, configured-principal invariants, audit spoofing and LIMIT/MARKET fills.

Second review: GET /admin/fee-settings additionally requires fees.read + wallets.read, and its PATCH/POST complete-response aliases require fees.manage + fees.read + wallets.read. All three shipped roles are tested with individually narrowed PostgreSQL read grants, both flag states, invalid-market/alternative-wallet/report probes and authorized unchanged response shapes. Guards reject before protected queries; role grants are unchanged.

All **34** administrative handlers have explicit policies: 22 core admin handlers, two flag reads, three security reads, six role/capability handlers and the legacy GET /users ADMIN alias. A real Nest controller inventory test checks exact coverage and valid permission keys. A deliberately policy-free Public test endpoint proves 401 without authentication and 403 with admin authentication, for both flag states. The [complete route table](./ADMIN_ROLE_PERMISSIONS.md#complete-administrative-route-inventory) documents every method/path/policy.

## 7. Role mutation and escalation protections

Review remediation additionally protects configured fee-principal identity with 409 and resolves effective legacy target authority inside the transaction. Status suspension revokes human access while preserving fee receipt; a second super-admin never implicitly replaces the configured fee owner.

Actor/target user locks and a shared PostgreSQL transaction advisory lock protect role/status/bootstrap mutations. Transactions recheck actor role, ACTIVE status, permissions and version; reject self-role changes, excess delegation and invalid roles; protect the last active non-system super-admin. Administrator status changes always require role-management authority, including when the rollout flag is off.

Second review: administrator freeze/ban/reactivation/no-op requests also enforce the same assigned/effective target-authority ceiling as role changes, including legitimate disabled-enforcement legacy ADMIN fallback, inside the protected transaction. Ordinary USER management remains users.manage only. Six new ordered real PostgreSQL role/status races protect increased target authority and USER-to-ADMIN transitions under both flag states. Authorized status changes retain session invalidation and fee-principal suspension behavior.

Role replacement requires fresh password and any enrolled second factor. Five-minute hash-only proofs bind actor, target and exact sorted replacement roles and are consumed atomically. Recovery/TOTP factors remain replay-protected. Removing an unassigned legacy ADMIN with an empty role set still removes its base ADMIN authority. A true no-op consumes proof without unnecessarily revoking target sessions.

## 8. Feature flag behavior

`enableAdminRolePermissions` remains false by default and remained false in development. Assigned roles are always constrained, so a viewer is read-only and an operator never inherits financial mutation authority by disabling the flag. Disabled mode retains prior operational access only for unassigned legacy ADMINs; enabled mode rejects those accounts too. Role mutations and administration of other administrators always require real admin_roles.manage. Unknown persisted roles fail closed. An empty replacement sets base identity to USER, so disabling the flag cannot revive a removed administrator. No general flag editor is implemented.

## 9. Session invalidation

Changed targets increment authVersion and lose pending proofs/login challenges; previously issued JWTs return 401. New sessions resolve current identity/grants from PostgreSQL. Admin suspension/reactivation also invalidates earlier sessions. Unrelated ordinary sessions remain valid. No stale browser/JWT permission claim authorizes a backend operation. Transactions governing roles/status recheck authority under the shared lock; other requests already executing before demotion may finish.

## 10. Security events

Role assignment/removal/update events are CRITICAL, actor/target/operation identified and contain only nonsecret role/base-identity changes. They commit in the protected transaction and fail closed. A real failing database trigger verified rollback of assignments, authVersion, proof consumption and partially inserted success events.

Denied admin authentication/authorization, rejected escalation, last-super-admin protection and reviewed offline bootstrap are logged through the existing sanitizing service. Denied route events include method/route policy identity and user target when applicable. Purpose-bound role reauthentication emits SENSITIVE_ACTION_CONFIRMED, and recovery-factor consumption preserves TWO_FACTOR_RECOVERY_USED events. Tests verified no generated password, JWT key, TOTP/recovery code, reauthentication token or enrollment secret appears in persisted role audit data. Existing login/email/TOTP events remain intact.

## 11. Admin UI behavior

`/admin/roles` shows current capabilities, roles, role descriptions, full permission registry and user assignments. Authorized administrators select replacement roles, supply fresh credentials/factor and review a sensitive-change confirmation. Self changes are disabled and backend errors remain clear. Empty assignments on a legacy ADMIN can explicitly remove its base authority. Target changes clear credential inputs. Users UI displays roles; navigation and mutation controls respect server capabilities, refreshed on focus/30-second intervals. Read-only user controls are labelled clearly. Responsive theme-token layouts and the trading terminal are preserved.

Production compilation and HTTP route smoke cover the UI. Authenticated browser interaction, mobile viewport and light/dark visual walkthroughs were not performed in this verification; no browser UI automation success is claimed.

## 12. Automated tests and exact results

Current second-remediation run: **68 RBAC + 31 authentication = 99 passed**, with no failures, skips or cancellations. Both real LIMIT and MARKET fill tests verify default 10-bps fee amounts and exact buyer/seller/original-principal balances after an unrelated demotion and fee-principal suspension. See the remediation report for numerical assertions.

| Suite | Passed | Failed | Skipped | Cancelled |
| --- | ---: | ---: | ---: | ---: |
| v1.0.4 real PostgreSQL/HTTP RBAC integration | 68 | 0 | 0 | 0 |
| v1.0.3/v1.0.4 real PostgreSQL authentication regression | 31 | 0 | 0 | 0 |
| Total | 99 | 0 | 0 | 0 |

RBAC tests cover ordinary/unauthenticated rejection; all permitted viewer reads and blocked mutation families; exact operator/super registries; multi-role assignment/removal; both flag states; legacy compatibility; missing-policy failure; route inventory; self changes; last-active-super protection; administrator suspension; authority ceilings; unknown/duplicate roles/permissions; profile/register role injection; target/purpose/expiry/replay binding; fresh enrolled factors and recovery-use audit; stale-session invalidation; true no-op behavior; legacy empty-assignment removal; secret redaction; real audit-failure rollback; and offline bootstrap/recovery.

The five original administrative races verify distinct PostgreSQL backend PIDs waiting on the shared lock before releasing a third blocking transaction: reciprocal demotion, suspension versus demotion, proof reuse, configured fee-principal removal versus ban, and ordered target-authority increase. Six added ordered status/role races under both flag states preserve stronger assigned/newly promoted targets. Three additional ten-request/ten-connection pool-saturation races cover role reauthentication, setup and enable: all complete with one 201, nine 401s and no unexpected 500 or queued pool acquisition. A factor-budget boundary race verifies one 201/nine 429s with exact durable counters. No database locking is mocked. The original 29 auth tests remain, supplemented by two pool regressions.

The last-super-admin status test asserts the exact invariant response and dedicated event, plus the real PostgreSQL predicate for a distinct sole-super target, so self-suspension rejection cannot mask a missing invariant. Five temporary compiled-output negative controls verify that reverting each protected boundary makes its regressions fail, including the exact last-super message check; fixed output is restored and the complete suites rerun unfiltered.

## 13. Builds, migrations and smoke

| Command | Final result |
| --- | --- |
| corepack pnpm db:generate | Passed; second/final generation reports no schema changes |
| corepack pnpm db:migrate | Passed against development and dedicated RBAC test database |
| Core Drizzle migrator with isolated URLs | Passed against development, RBAC test and existing auth test databases |
| corepack pnpm --filter @sw-exchange/shared build | Passed |
| corepack pnpm --filter @sw-exchange/api build | Passed |
| NEXT_DIST_DIR=.next-verify corepack pnpm --filter @sw-exchange/web build | Passed; 33 pages generated |
| corepack pnpm --filter @sw-exchange/api test:admin | 68 passed, zero failures/skips/cancellations |
| corepack pnpm --filter @sw-exchange/api test:auth | 31 passed, zero failures/skips/cancellations |
| corepack pnpm --filter @sw-exchange/api exec tsc --noEmit -p tsconfig.json | Passed, including integration-test source |
| corepack pnpm --filter @sw-exchange/web exec tsc --noEmit | Passed |
| corepack pnpm smoke | 21 PASS groups, zero failed/skipped, including production build |
| git diff --check | Passed |

The current remediation RBAC suite and smoke use separate dedicated native local PostgreSQL database `sw_exchange_admin_test_v104_remediation_20261101` (the original baseline used `sw_exchange_admin_test_v104_20261101`); auth regression used the existing dedicated `sw_exchange_auth_test_v103_20261031`. DATABASE_URL_TEST was supplied to child processes without printing credentials. Existing ignored .env/.env.test.local files were not rewritten. The test suites were run serially for final verification. The smoke administrator was explicitly bootstrapped only in the dedicated smoke database; invariant tests restore that fixture assignment first.

The second-review verification services stop after full smoke. The API uses the compiled Nest application with logging disabled, and the web uses production start against .next-verify. Console-email verification tokens are not printed. Smoke retains its separate .next-smoke build directory; no build targets a running server's output. Generated Next type/config edits are restored and type checks rerun. The isolated smoke principal's password and grants are restored after smoke; no development identity is modified. No database or volume is reset/deleted.

Full smoke exercises role registry/capabilities and the new role page plus auth, flags, email verification, airdrops, wallet buckets, internal transfers, ledger, fees/settlement, matching, partial fills, maker pricing/refunds/cancel, market data/valuation, admin controls, asset/market creation, candles, market orders/isolation, security events, logout, web routes and production build. A pre-existing exact 403 message expectation was preserved after the first smoke exposed the mismatch.

Full-row development checksums match before/after the second review for users (7), trades (63), wallets (258), fee_settings (23), orders (126), transfers (3), ledger_entries (603) and feature_flags (14). All pre-existing migration files/snapshots/journal remain byte-identical. Source diffs confirm trading-core/FeesService/accounting code is unchanged.

## 14. Remaining security concerns and verification limits

- Optional MFA remains optional; mandatory admin MFA and general financial/configuration action step-up are future policies. Role changes do enforce fresh password and any enrolled factor.
- Review orphaned/unassigned ADMINs before disabling enforcement; assigned least-privilege roles remain constrained.
- Trusted database owners/offline maintenance can bypass application RBAC; bootstrap/recovery must use restricted credentials and review references.
- Shared audit context now uses only socket.remoteAddress and ignores arbitrary forwarding headers/request.ip. A future reverse proxy requires explicit trust configuration; until then audit IPs identify the socket peer.
- Configured fee-principal ADMIN identity removal now returns 409 under the protected transaction; full platform-principal separation remains a reviewed future ownership/migration task. Human status suspension is allowed without breaking fee lookup.
- No multi-party approval or arbitrary role editor is added. Rejection logging remains best-effort; successful role mutation audits are transactionally required.
- Authenticated browser/visual interaction, deployment/cross-host proxy behavior and production operations were not tested here.

## 15. Documentation updates

README, architecture state, account model, API contracts, event flow, auth/security plan, feature flags, roadmap, version history, future roadmap, technical debt, limitations, implementation sequence, testing rules, docs index and milestone copy now reflect v1.0.4 and planned v1.1. The new runbook includes the registry, every route, migration assumptions, rollout semantics, session behavior and bootstrap/recovery instructions. Historical milestone evidence remains historical.

## 16. Trading core unchanged

Verified no diff in orders, wallets, fees, internal transfers, trades, ledger or money-calculation source. No LIMIT/MARKET matching, fee math, wallet accounting, transfer or settlement behavior is changed. Admin controller policies and account status/role authorization change eligibility only. Full smoke protects the existing behavior.

## 17. Excluded functionality

No blockchain gateway, deposit addresses/listeners/crediting, withdrawals, hot-wallet signing, margin, futures, liquidation, KYC, SMS, general feature-flag editor or advanced-order functionality is added. v1.1 chain registry remains planned-only.

## 18. Git and data safety

No commit, push, staging, branch change, database reset or Docker volume removal occurred. The original development user/trade counts are retained. No secrets, local database files, environment files, sample files, logs or build outputs are added to reviewable changes. TypeScript/isolated build artifacts are ignored. All changes remain available for review in the working tree.

## Complete changed-file inventory

- `.gitignore`
- `README.md`
- `apps/api/package.json`
- `apps/api/src/admin-roles/admin-permissions.decorator.ts`
- `apps/api/src/admin-roles/admin-permissions.guard.ts`
- `apps/api/src/admin-roles/admin-roles.controller.ts`
- `apps/api/src/admin-roles/admin-roles.integration.spec.ts`
- `apps/api/src/admin-roles/admin-roles.module.ts`
- `apps/api/src/admin-roles/admin-roles.service.ts`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/two-factor.service.ts`
- `apps/api/src/auth/two-factor.integration.spec.ts`
- `apps/api/src/common/guards/jwt-auth.guard.ts`
- `apps/api/src/db/schema/index.ts`
- `apps/api/src/feature-flags/admin-feature-flags.controller.ts`
- `apps/api/src/feature-flags/feature-flags.service.ts`
- `apps/api/src/scripts/bootstrap-admin-roles.ts`
- `apps/api/src/scripts/seed.ts`
- `apps/api/src/security/admin-security.controller.ts`
- `apps/api/src/security/security-events.service.ts`
- `apps/api/src/users/users.controller.ts`
- `apps/web/app/admin/airdrop/page.tsx`
- `apps/web/app/admin/assets/page.tsx`
- `apps/web/app/admin/fees/page.tsx`
- `apps/web/app/admin/markets/page.tsx`
- `apps/web/app/admin/roles/page.tsx`
- `apps/web/app/admin/users/page.tsx`
- `apps/web/app/admin/wallets/page.tsx`
- `apps/web/components/auth/protected-route.tsx`
- `apps/web/components/shell/sidebar.tsx`
- `apps/web/lib/api-types.ts`
- `apps/web/lib/milestone-copy.ts`
- `apps/web/lib/navigation.ts`
- `apps/web/providers/auth-provider.tsx`
- `docs/ACCOUNT_MODEL.md`
- `docs/ADMIN_ROLE_PERMISSIONS.md`
- `docs/API_CONTRACTS.md`
- `docs/ARCHITECTURE_STATE.md`
- `docs/CURRENT_LIMITATIONS.md`
- `docs/EVENT_FLOW.md`
- `docs/FEATURE_FLAGS_PLAN.md`
- `docs/FUTURE_ROADMAP.md`
- `docs/KNOWN_TECH_DEBT.md`
- `docs/README.md`
- `docs/ROADMAP.md`
- `docs/TESTING_RULES.md`
- `docs/V1_0_4_REMEDIATION.md`
- `docs/V1_0_4_VERIFICATION.md`
- `docs/V1_AUTH_SECURITY_PLAN.md`
- `docs/V1_IMPLEMENTATION_SEQUENCE.md`
- `docs/VERSION_HISTORY.md`
- `drizzle/0015_luxuriant_bug.sql`
- `drizzle/0016_overconfident_prodigy.sql`
- `drizzle/meta/0015_snapshot.json`
- `drizzle/meta/0016_snapshot.json`
- `drizzle/meta/_journal.json`
- `packages/shared/src/admin-permissions.ts`
- `packages/shared/src/index.ts`
- `scripts/smoke.ts`
