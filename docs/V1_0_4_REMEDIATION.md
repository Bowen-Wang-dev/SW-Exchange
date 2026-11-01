# v1.0.4 Security Review Remediation

Date: November 1, 2026 (Australia/Sydney). Implementation milestone remains **v1.0.4 Admin Role Permissions**; **v1.1 Chain Asset Registry** remains planned-only. The existing uncommitted implementation and working-tree changes are preserved. No commit or push is performed.

## Second review — current implementation and results

This section supersedes the first-review test totals below. The numbered first-review report is retained as historical evidence; its four fixes are preserved.

### Initial repository state and scope

`git status --short --branch` showed `main...origin/main`, **45 modified tracked files and 16 untracked files** at `9826f05d5763c6ffb3bec6a39959229ea1526bfa`. The preceding commits were `5fb3f80` and `d6ce004`. The existing uncommitted v1.0.4 implementation, migrations 0015/0016, frontend and first remediation were inspected in place. A temporary baseline diff/file-hash inventory protected the pre-existing work. No reset, clean, revert, staging, commit or push occurred.

Fourteen files change in this second remediation:

- `apps/api/src/auth/two-factor.service.ts`
- `apps/api/src/auth/two-factor.integration.spec.ts`
- `apps/api/src/feature-flags/feature-flags.service.ts`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin-roles/admin-roles.service.ts`
- `apps/api/src/admin-roles/admin-roles.integration.spec.ts`
- `packages/shared/src/admin-permissions.ts`
- `docs/V1_0_4_REMEDIATION.md`
- `docs/V1_0_4_VERIFICATION.md`
- `docs/ADMIN_ROLE_PERMISSIONS.md`
- `docs/ARCHITECTURE_STATE.md`
- `docs/API_CONTRACTS.md`
- `docs/KNOWN_TECH_DEBT.md`
- `docs/V1_AUTH_SECURITY_PLAN.md`

### Finding A: PostgreSQL pool dependency cycle

Role-purpose reauthentication previously locked the actor row and then used AuthRateLimitService's independent pooled connection for factor accounting. Ten overlapping transactions could occupy all ten pool connections: nine waited for the actor row while its lock holder waited for an eleventh connection. The ordinary setup/enable paths had the same nested-acquisition risk through their enable2FA flag reader.

The password counter and role-purpose factor counter now finish as independent, atomic, durable operations **before** the user transaction/lock. Each admitted role-proof request reserves the existing factor budget, including unenrolled and wrong-password requests; this conservative accounting prevents racing enrollment from bypassing the budget. The locked transaction still rechecks user/session state, verifies the password and any enrolled factor, and creates actor/purpose-bound five-minute hash-only proofs. Failure cannot roll back counters. Setup/enable pass their transaction to assertFeatureEnabled; flag reads use that same connection. Security events remain after commit/rollback; factor/proof single-use consumption remains in the existing transaction. Other directly related login/management limiter and event calls were inspected; their counters already precede user locking and their events run after transactions.

No production pool-size or timeout change is made. Test infrastructure retains protective statement/lock timeouts and adds twelve-second contention-test deadlines.

Real HTTP/PostgreSQL contention regressions deliberately bound the application pool to ten and use a separate blocking/observing connection to prove **ten distinct backend PIDs** simultaneously wait for the same user row before release:

- Role reauthentication: ten requests complete with **1 HTTP 201, 9 HTTP 401, no HTTP 500**, both counters exactly 10, no pool acquisition left queued, one recovery-use event and one sensitive-action confirmation. The next request returns 429 with password counter 11 and factor counter 10. The surviving proof rejects another target/purpose, succeeds once and rejects replay; persisted events contain none of the tested secrets.
- Setup and enable: each ten-request race has **1 HTTP 201 and 9 HTTP 401**, exact attempt counts and no queued pool acquisition. Existing replay/expiry/user-purpose/session tests remain.
- Shared factor budget: starting at 29, ten concurrent role reauthentications produce **1 HTTP 201 and 9 HTTP 429**; the factor counter is 39 and password counter is 10, proving durable atomic accounting for rejected attempts.

### Finding B: fee-wallet disclosure boundary

The complete GET fee-settings response now requires **fees.read + wallets.read** through ADMIN_FEE_SETTINGS_READ_PERMISSIONS. PATCH and POST return the same balance-bearing shape, so both require **fees.manage + fees.read + wallets.read**. Authorization runs in the global guard before settings/principal/balance queries. FeesService and its response shape, fee formulas and wallet accounting are unchanged. All wallet aliases and the existing six-scope complete-report boundary retain their own checks. No grants are broadened.

Three new regression cases narrow real PostgreSQL grants for viewer/operator/super_admin, under both flag states: each missing read scope yields 403 through GET and both mutation aliases, including an invalid-market probe that proves handler authorization precedes lookup. wallets.read alone cannot obtain settings; fees.read alone cannot obtain balances. Alternative wallet aliases and complete reports remain protected. Fully authorized shipped roles retain raw balance fields, and both authorized management aliases persist unchanged rates/shape.

### Finding C: administrator status authority ceiling

Inside the existing shared advisory-lock/target-row-lock transaction, authorizeAdminStatus rechecks ACTIVE/non-system ADMIN identity, authVersion and explicit role-management permission, resolves actor/target capabilities using that same transaction, and rejects any assigned/effective target permission exceeding the actor's effective authority. This covers freeze, ban, reactivation and no-op requests. Disabled enforcement includes legitimate unassigned ADMIN fallback; enabled enforcement does not invent fallback. USER targets continue through users.manage without administrator fallback. Role/status lock ordering, last-active-super-admin protection, authorized fee-principal suspension and successful session/proof/challenge invalidation remain intact. No alternate status-mutation endpoint was found.

Ten new status regressions cover stronger assigned targets, legacy targets and legitimate ordinary/full-authority management with enforcement on/off. Six ordered races use independent PostgreSQL backends queued behind a third connection's administrative lock: target authority increases before freeze/reactivation, or a USER becomes a stronger administrator before a queued freeze. Each role mutation returns 200 and the subsequent insufficient status mutation returns 403, preserving the new roles, target status and expected authVersion. Existing reciprocal demotion, suspension/demotion, proof reuse and fee-principal races still pass. Successful authorized transitions invalidate previous JWTs; fresh login remains functional.

### Independent last-super-admin assertion

The status test now requires the **exact last-super-admin error message and dedicated ADMIN_LAST_SUPER_ADMIN_PROTECTED event**; a generic self-suspension 403 cannot satisfy it. It also tests the real PostgreSQL invariant predicate with a distinct target that is the sole active super-admin. This additional predicate test avoids the shipped registry's structural constraint that every authorized role manager is itself a super-admin. The existing self-role/last-super tests remain.

### Exact final verification

| Check | Passed | Failed | Skipped | Cancelled |
| --- | ---: | ---: | ---: | ---: |
| Complete RBAC HTTP/PostgreSQL suite | 68 | 0 | 0 | 0 |
| Complete authentication HTTP/PostgreSQL suite | 31 | 0 | 0 | 0 |
| Combined integration tests | 99 | 0 | 0 | 0 |
| Full smoke PASS groups, including production web build | 21 | 0 | 0 | 0 |

The 53/29 first-review baseline expands by **15 RBAC + 2 authentication** tests. Final integration commands run unfiltered and serially, without skipped database checks. Real LIMIT and MARKET fee-settlement regressions both pass with the original exact six-wallet/fee assertions documented below.

- `corepack pnpm --filter @sw-exchange/shared build`: passed.
- `corepack pnpm --filter @sw-exchange/api build`: passed, also rebuilt by each complete integration command.
- `NEXT_DIST_DIR=.next-verify corepack pnpm --filter @sw-exchange/web build`: passed; 33 pages generated.
- `corepack pnpm --filter @sw-exchange/api test:admin`: 68/0/0/0.
- `corepack pnpm --filter @sw-exchange/api test:auth`: 31/0/0/0.
- `corepack pnpm --filter @sw-exchange/api exec tsc --noEmit -p tsconfig.json`: passed, including test source.
- `corepack pnpm --filter @sw-exchange/web exec tsc --noEmit`: passed, including after generated metadata restoration.
- `corepack pnpm smoke`: all 21 groups passed, ending “Smoke test completed successfully.”
- `git diff --check`: passed.

Five temporary **negative controls** independently restored vulnerable behavior only in ignored compiled test output, then restored the fixed bytes: lock-held role limiter, lock-held setup/enable flag reads, missing fee-wallet policy, missing status ceiling and missing status last-super check. Every control produced the intended regression assertion failure. In particular, the restored pool dependency produced HTTP 500 under protective timeouts; removing the last-super status check failed the exact-message assertion despite self-suspension protection. These diagnostic failures are expected controls, not final-suite failures. The final unfiltered suites run after restoration/rebuild.

Initial verification attempts exposed two test-fixture issues (activity-query truncation and a missing MFA JWT claim) and two temporary smoke-wrapper issues (a test database role without CREATEDB and module resolution from /tmp). The observer/fixtures/wrapper were corrected; no production authority or timeout was weakened. Smoke reused the established test database rather than escalating database privileges or creating/resetting databases.

### Isolation, preservation and limitations

RBAC and full smoke use the existing `sw_exchange_admin_test_v104_remediation_20261101` and its documented `remediation-smoke-admin@example.test` identity; auth uses `sw_exchange_auth_test_v103_20261031`. Integration fixtures use generated identities/passwords. Only the isolated smoke principal receives temporary credentials and reviewed bootstrap; its original password/grants are restored afterward, while session invalidation is retained. Existing .env/.env.test.local/.env.production files are not rewritten. Smoke uses the compiled Nest application with logging disabled and a production web server in .next-verify; its separate .next-smoke build never shares that output directory. Verification services stop afterward; generated Next config/type files are restored.

Development data is read only for before/after full-row checksums. All eight counts and checksums match: **users 7, trades 63, wallets 258, fee_settings 23, orders 126, transfers 3, ledger_entries 603, feature_flags 14**. No database reset, database deletion or Docker-volume deletion occurs. All existing migration/snapshot/journal files remain byte-identical to the second-session baseline; no schema/migration is added or edited. No matching, fee-formula, wallet-accounting, transfer, ledger or settlement source is changed.

All requested runbook/API/architecture/verification/debt documents are updated. Mandatory administrator MFA, trusted-proxy configuration and fee-principal separation remain separate future hardening; v1.1 remains planned only. These tests reproduce real local PostgreSQL contention, not production load/cross-host deployment or authenticated browser/mobile/theme walkthroughs. Rejection-event persistence retains its existing best-effort policy. No secrets are printed by the verification harness or included in source changes; no logs/build outputs/environment files are staged. **No commit or push occurs.**

---

## First review — historical report (53 RBAC / 29 authentication)

## 1. Files changed in this remediation

Backend/shared/test code:
- `apps/api/src/admin-roles/admin-roles.service.ts`: configured fee-principal invariant and shared legacy-aware target authority, with transactional reads.
- `apps/api/src/feature-flags/feature-flags.service.ts`: optional transaction-aware reader; public/default behavior is preserved.
- `apps/api/src/admin/admin.controller.ts`: complete-report permission set.
- `apps/api/src/security/security-events.service.ts`: centralized socket-only audit attribution.
- `packages/shared/src/admin-permissions.ts`: explicit six-scope complete-report policy; existing 20 permissions and role grants unchanged.
- `apps/api/src/admin-roles/admin-roles.integration.spec.ts`: 20 added regression tests and isolated fixture cleanup.

Documentation: README, ACCOUNT_MODEL, ADMIN_ROLE_PERMISSIONS, V1_0_4_VERIFICATION, ARCHITECTURE_STATE, API_CONTRACTS, KNOWN_TECH_DEBT, V1_AUTH_SECURITY_PLAN, TESTING_RULES, EVENT_FLOW, ROADMAP, VERSION_HISTORY, docs index and this report. No frontend layout or trading-terminal source changes are needed.

## 2. P1 configured fee-principal invariant

FeesService selects the exact configured ADMIN_EMAIL with base role ADMIN and isSystem=false. Both LIMIT and MARKET fills depend on that same principal. Another super-admin does not replace it.

Under the shared administrative advisory lock and locked target row, role replacement now rejects removal of the configured principal's ADMIN identity with **409 Conflict**, before consuming the proof or mutating assignments/session version. The existing last-active-super-admin and self-change protections remain independent. Nonempty role restrictions may reduce the principal's human administrative capabilities while preserving ADMIN identity and fee ownership.

Status suspension is deliberately **not** blocked solely because the account receives fees. The existing fee lookup has no ACTIVE-status predicate. An authorized other administrator may freeze/ban it, subject to self/last-super protections, while status changes revoke human sessions and retain fee receipt. The status DTO cannot change role/email/system identity; no ordinary profile, email-change or account-deletion API provides a bypass. Tests cover rejected identity removal before/after status changes and concurrent removal versus suspension.

Changing ADMIN_EMAIL or fully offboarding this fee owner requires a reviewed maintenance/ownership procedure. There is no balance transfer, new recipient or accounting migration in this fix.

## 3. Actual LIMIT/MARKET settlement results

Two real HTTP/PostgreSQL tests each create their own two assets, market, buyer, seller and fee principal. They execute an unrelated administrator's demotion, reject configured-principal removal, suspend that principal and then execute one full fill:

- LIMIT: resting LIMIT SELL matched by LIMIT BUY.
- MARKET: resting LIMIT SELL matched by MARKET BUY.

Each market uses two decimal places, price 10 and amount 10, with unchanged default buyer/seller fees of 10 bps. Each fill persists SETTLED and verifies:

| Wallet | Expected available balance (minimal units) |
| --- | ---: |
| Buyer MAIN base | 999 |
| Buyer MAIN quote, initially 100000 | 90000 |
| Seller MAIN base, initially 10000 | 9000 |
| Seller MAIN quote | 9990 |
| Original configured principal FEE base | 1 |
| Original configured principal FEE quote | 10 |

All six locked balances are zero. Persisted fee amounts are 1 base and 10 quote minimal units, with both recorded rates 10 bps. No fee percentage/formula or settlement implementation is changed. All market/asset/trade/order/wallet/ledger fixtures from these tests are removed without touching existing trading data.

## 4. Audit source-IP attribution

The centralized extractor now accepts only socket.remoteAddress and returns null if it is unavailable. X-Forwarded-For, X-Real-IP and request.ip cannot override it. User-agent handling, actor/target attribution and metadata normalization/redaction remain unchanged.

Separate role-mutation tests forge each header and assert persisted source IP 127.0.0.1 with correct actor UUID, target UUID and changed roles. An existing user-status consumer is tested with both headers forged. A direct extractor check rejects spoofed request.ip and uses null without a socket. Existing auth flows already override with the socket peer; the central fix also protects role/status, admin feature-flag, asset/market, fee, wallet, airdrop, email and 2FA consumers of the helper.

## 5. Complete-report permission isolation

Chosen policy: **Option A, complete report requires all underlying scopes**. ADMIN_REPORT_PERMISSIONS contains reports.read, audit.read, fees.read, wallets.read, trades.read and transfers.read. The global guard rejects missing scopes before invoking the handler, so unauthorized raw subsections are neither queried nor returned.

Counts/public market summaries require reports.read; raw audit records require audit.read; fee-configuration/principal lookup requires fees.read; fee-wallet balances require wallets.read; raw trades/transfers require their respective read scopes. The complete response shape is unchanged for authorized clients. GET /api/admin remains aggregate-only counters under reports.read. No viewer/operator grants are expanded.

Five regression cases revoke each underlying resource scope for both viewer and operator and assert 403 without raw audit, balances, trades or transfers, under both flag states. Complete-report access succeeds for all three shipped roles with their intended grants. The metadata inventory remains at 34 explicit handlers, supplemented by behavioral assertions.

## 6. Legacy-aware delegation

Target effective authority now uses the same capabilities resolver as the backend guard and the role transaction's database connection. Feature-flag reads accept that connection, avoiding a separate nontransactional reader during role/status authorization.

With enforcement disabled, an unassigned non-system ADMIN has its legitimate legacy operational scopes included in the target ceiling. With enforcement enabled it has no granular fallback. Explicit target grants are also protected, including latent assigned authority on suspended accounts. USER/system/missing identities never receive legacy fallback. Actor role-management authority remains an explicit assigned grant in both flag states; target fallback cannot authorize the actor.

Tests cover narrower/sufficient actors, both flag states, assigned and unassigned targets, ordinary USER capabilities, removal to USER and a queued target whose permissions increase before the second transaction acquires the lock. The second request rechecks and returns 403 rather than overwriting stronger authority.

## 7. Semantic authorization tests added

Twenty tests supplement the prior 33:
- Configured fee principal, status changes and a concurrent identity-removal/status race.
- Separate forged-header role audits, an existing consumer, socket/request.ip/missing-peer behavior.
- Five narrowed complete-report resource scopes and authorized complete responses.
- Legacy/assigned target ceilings, ordinary identity exclusion and ordered concurrent authority changes.
- Valid-payload mutation matrix covering users.manage, assets.manage, markets.manage, fees.manage, wallets.manage and airdrops.execute. It exercises denied viewer/ordinary/operator actions, individually revoked write grants, authorized operations and actual persisted status, asset metadata, market status, fee settings and balances. Asset/market creation is also exercised as operator through fixture APIs.
- Two actual LIMIT/MARKET fill regressions with exact wallet and persisted fee assertions.

The 34-route inventory, prior role assignment/removal, self-escalation, proof binding, session revocation, audit rollback and last-super protections are retained. No assertions are weakened or database checks replaced by mocks.

## 8. RBAC integration results

**53 passed, 0 failed, 0 skipped, 0 cancelled.**

Executed through `corepack pnpm --filter @sw-exchange/api test:admin` with DATABASE_URL_TEST supplied to the child process for the dedicated remediation database. The command rebuilds the real API before executing the HTTP/PostgreSQL tests.

## 9. Authentication integration results

**29 passed, 0 failed, 0 skipped, 0 cancelled.**

Executed `corepack pnpm --filter @sw-exchange/api test:auth` against its existing dedicated auth database. Normal login/register/logout, email state, TOTP enrollment/management, purpose-bound reauthentication, replay protection, session versions, limits, cleanup and redaction remain intact.

## 10. Real database concurrency results

Five administrative races pass:
1. Reciprocal super-admin demotion: one success, one stale-actor rejection; one active super-admin remains.
2. Suspension versus demotion: one protected operation succeeds; active-super invariant remains.
3. Same proof consumed concurrently: one success and one 401.
4. Configured fee-principal role removal versus ban: 409 for identity removal, 200 for status change; original principal's fee lookup remains available.
5. Ordered target-authority increase: first full manager changes viewer to operator; queued narrower manager then gets 403, preserving operator authority and its unconsumed proof.

Tests hold the real PostgreSQL advisory lock on a third connection and confirm distinct waiting backend PIDs before release. The ordered case waits for the first backend to queue before starting the second. The existing auth suite's three factor-consumption races and atomic limiter race also pass.

## 11. Full smoke results

Passed: full suite completed successfully, including production web build.

The full existing suite runs against the separate remediation database, including internal transfers, airdrops, wallet buckets/ledger, fee accounting, LIMIT/MARKET matching, partial fills, maker prices/refunds/cancellation, market data, asset/market administration, security events, logout, web routes and its independent .next-smoke production build. No development database is used for smoke mutations.

## 12. Build and static-check results

- Shared build: passed.
- API build: passed, including both integration commands.
- Web production build: passed using NEXT_DIST_DIR=.next-verify, 33 pages generated.
- Full API TypeScript check including tests: passed.
- git diff --check: passed.
- Final web type check and metadata restoration: passed; generated Next configuration/type metadata restored..

The production build uses .next-verify; dev uses .next; smoke uses .next-smoke. Builds do not target the same output directory as the running dev server. Next-generated configuration/type-path changes are restored from a pre-verification snapshot.

## 13. Schema and migration changes

**No new schema or migration is required.** Existing 0015/0016 and all historical migration files are unchanged. The dedicated remediation database is initialized with the existing 17-entry journal; no existing database is reset or Docker volume removed. Transaction-aware reads and configuration identity checks are application-level changes only.

## 14. Verification documentation

The role runbook, API contracts, architecture, security/testing/event-flow docs, technical debt and README are updated. V1_0_4_VERIFICATION.md points to this remediation and records the current test totals. The original implementation's 33-test result is historical; the current RBAC total is 53. v1.0.4 remains the implementation milestone, with v1.1 Chain Asset Registry planned-only.

## 15. Remaining risks and technical debt

- Platform fee ownership remains coupled to a configured human ADMIN. The new invariant prevents accidental demotion from breaking fee lookup; true service-principal separation needs a reviewed ownership/migration plan.
- No trusted reverse proxy is configured. Behind a shared proxy, recorded socket IP is the proxy's address until an explicit trust policy and deployment tests exist. Forwarding headers remain ignored.
- Disabling granular enforcement still restores operational compatibility for unassigned legacy ADMINs; review that population before rollback. Assigned roles remain constrained.
- Optional MFA remains optional; broader financial-action step-up and multi-party approval remain future controls.
- Direct database/configuration owners remain trusted. Out-of-band flag or ADMIN_EMAIL changes require controlled operational review.
- Authenticated browser/theme/mobile walkthroughs and production deployment are not performed in this backend remediation. The existing frontend is not redesigned.

## 16. Existing data preservation

All eight development table row counts and full-row checksums match their pre-verification baseline: users **7**, trades **63**, wallets **258**, fee_settings **23**, orders **126**, transfers **3**, ledger_entries **603**, feature_flags **14**. Existing users, balances, settings and historical trading records are unchanged. All **17** existing migration file hashes/timestamps match the remediation database; no new migration was generated.

The separate database is `sw_exchange_admin_test_v104_remediation_20261101`. Existing .env/.env.test.local files are not rewritten. Dedicated test fixtures and smoke data do not enter development. A before/after checksum compares all rows in development users, trades, wallets, fee_settings, orders, transfers, ledger_entries and feature_flags, including settings and balances rather than counts alone.

## 17. Trading-core business behavior

No changes to orders/matching, fee-service/calculation code, wallets/accounting, trades/settlement, internal transfers, ledger or money arithmetic. Existing fee principal, percentages and recipient ownership remain unchanged. Guards change authorization and protect identity transitions; actual settlement regressions verify unchanged numerical behavior.

## 18. Excluded features

No blockchain integration, deposit/withdrawal/address/listener/signing flow, margin, futures, liquidation, general feature-flag editor or new trading capability is added. No frontend/trading-terminal redesign occurs.

## 19. Secrets and generated artifacts

No credentials, JWTs, TOTP/recovery codes, encryption keys, local environment files, database dumps, logs or build outputs are committed or included in reviewable changes. Generated verification credentials remain in a mode-0600 temporary file during execution; informational console-mail logs are suppressed. Temporary credentials/logs are removed after verification. Source tests use generated ephemeral credentials and log no secret values.

## 20. Git state

The existing uncommitted implementation is preserved on main at starting commit `9826f05`. No staging, commit, push or branch change occurs. Verification services are stopped after smoke; existing databases and volumes are retained.
