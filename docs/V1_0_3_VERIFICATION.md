# v1.0.3 database and regression verification

Verified on October 31, 2026, in the Australia/Sydney local environment.
No commit or push was performed during that verification phase.

## Environment and isolation

- Native Homebrew PostgreSQL 16.15, listening locally on port 5432.
- The existing PostgreSQL data directory was started through an approved local
  execution request. Docker is not installed on this machine.
- Development database: sw_exchange.
- Dedicated integration database: sw_exchange_auth_test_v103_20261031.
- DATABASE_URL_TEST is configured in ignored .env.test.local. No connection
  credentials are included in this report.
- The integration suite rejects missing configuration, non-local targets, database
  names without a test marker, and collisions with configured development or
  production database identities. It does not silently skip database tests.
- The suite creates its own users, uses the actual compiled Nest application and
  HTTP authentication guards, and removes only its own fixture users/wallets/events.

## Migrations and existing data

The repository migration command was executed against both databases:

    corepack pnpm --filter @sw-exchange/api migrate

For the isolated run, DATABASE_URL was supplied from DATABASE_URL_TEST to the
child process without printing it. All 15 journal entries (0000 through 0014)
matched their stored database timestamps and SHA-256 migration file hashes.

Development applied the new migrations:
- 0013_eager_nocturne: TOTP state, challenge/recovery tables, rate-limit state.
- 0014_auth_reauth_tokens: purpose-bound reauthentication records.

The separate test database applied all migrations from an empty database.
The development database retained 5 users and 42 trades after migrations and auth
tests. The full smoke suite then added its normal fixtures, leaving 7 users and
63 trades. No database was reset, no volume was removed, and no existing user or
trade records were deleted as part of verification.

## Commands and final results

| Command | Final result |
| --- | --- |
| corepack pnpm --filter @sw-exchange/shared build | Passed |
| corepack pnpm --filter @sw-exchange/api build | Passed, also run by test:auth |
| corepack pnpm --filter @sw-exchange/web build | Passed |
| corepack pnpm --filter @sw-exchange/api test:auth | 29 passed, 0 failed, 0 skipped |
| WATCHPACK_POLLING=true corepack pnpm smoke | Passed, full suite |
| corepack pnpm --filter @sw-exchange/api exec tsc --noEmit -p tsconfig.json | Passed |
| git diff --check | Passed |

The smoke stack used the repository's corepack pnpm dev:local command. A temporary
NODE_OPTIONS preload disabled informational Nest logs before startup so the
existing development console-mail provider did not emit email verification
tokens during verification. The normal web build finished before starting the
dev server; the smoke suite's build used its existing separate .next-smoke output
directory and cleaned it afterwards.

Smoke passed authentication, feature flags, email verification, airdrops, wallet
buckets, internal transfers, ledger balances, fees and settlement, matching,
partial fills, maker pricing, refunds, order cancellation, market data/valuation,
admin controls, asset/market creation, candles, market orders, market isolation,
security events, logout, web routes, and web production build.

## Real database security coverage

The auth suite exercises non-2FA and legacy JWT compatibility; enrollment and
activation; invalid setup codes; password-only rejection for enabled users;
reauthentication password, user and purpose binding, expiry, replay and rollback;
challenge expiry, single-use and persisted attempt exhaustion; recovery-code
single-use/regeneration; TOTP replay after activation and after login; disabled
feature flag behavior and continued enforcement for existing enabled accounts;
authVersion invalidation after enable/disable; ciphertext authentication; security
event and public-API redaction; login/reauthentication limits; and record cleanup.

Three consumption races use two independent HTTP requests and actual PostgreSQL
transactions. A third connection holds the user row lock; the test verifies two
distinct database backend PIDs are waiting for the lock before releasing it.
- Concurrent reauthentication/setup: exactly one success and one rejection.
- Concurrent login challenge: exactly one success, one rejection, one factor use.
- Concurrent recovery code across login and regeneration: exactly one success and
  one rejection.
- A separate 20-request database limiter race accepted exactly 5 requests at a
  limit of 5 and persisted all 20 atomic increments.

Activity snapshots are explicitly refreshed while observing the blocked backends.
There are no mocked database constraints, authentication services, feature-flag
services, rate-limit services or security-event persistence in these checks.

## Corrections found during verification

1. Setup previously awaited an audit insert on a second connection while holding
   a user FOR UPDATE lock. The audit foreign key waited for that same user lock,
   stalling enrollment. Audit emission now occurs after the transaction commits;
   protected state changes and reauthentication consumption remain atomic.
2. Reauthentication now has an authenticated per-user password-attempt budget.
   Reissuing a purpose replaces the prior token; enable/disable revoke outstanding
   reauthentication records, and expired records participate in retention cleanup.
3. The root smoke script imported @sw-exchange/shared without declaring a root
   dependency. The workspace dependency and lockfile are now declared correctly.
4. The prior skipped/mocked/single-client tests were replaced by fail-fast,
   isolated, real HTTP/PostgreSQL integration tests.

## Operational limits

The checked-in development and production Compose files publish the API directly;
there is no reverse proxy or Express trust-proxy configuration in this milestone.
Auth throttling deliberately uses the socket peer and ignores untrusted
X-Forwarded-For/X-Real-IP. Header-spoofing tests passed. If a shared reverse proxy
is introduced, clients will share the socket-IP budgets until an explicit trusted
proxy topology is configured and verified; no live proxy deployment was tested.

The legacy email console provider remains a development-only logging limitation;
its informational logs were suppressed during this verification. Production
deployment, key rotation, browser UI interaction automation and a future reverse
proxy deployment are outside these local regression results.

No trading-core source changed, no new credentials were added to reviewable
repository files, no credential/token values were printed during the verification,
and no commit or push occurred during that verification phase.
