import "reflect-metadata";
import { strict as assert } from "node:assert";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { before, beforeEach, after, describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import { NestFactory } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { hash } from "bcryptjs";
import { generate } from "otplib";
import { Pool } from "pg";
import { hashCredential, decryptTotp, encryptTotp, newTotpSecret } from "./two-factor.crypto.js";

// This command must fail, not silently skip, when a dedicated database is absent.
const root = new URL("../../../../", import.meta.url);
function envFile(name: string) {
  const path = fileURLToPath(new URL(name, root));
  return existsSync(path) ? parse(readFileSync(path)) : {};
}
const development = envFile(".env");
const production = envFile(".env.production");
const databaseUrl = process.env.DATABASE_URL_TEST ?? envFile(".env.test.local").DATABASE_URL_TEST;
if (!databaseUrl) throw new Error("DATABASE_URL_TEST is required; auth integration tests cannot be skipped.");
function identity(value: string) {
  const url = new URL(value);
  return (url.hostname === "localhost" ? "127.0.0.1" : url.hostname) + ":" + (url.port || "5432") + url.pathname;
}
const target = new URL(databaseUrl);
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || !/_test(?:_|$)/.test(target.pathname)) {
  throw new Error("Auth tests require an explicitly named local test database.");
}
for (const other of [process.env.DATABASE_URL, development.DATABASE_URL, production.DATABASE_URL]) {
  if (other && identity(other) === identity(databaseUrl)) throw new Error("Refusing to test against a development or production database.");
}
process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = "test";
process.env.PGOPTIONS = "-c statement_timeout=15000 -c lock_timeout=5000";
process.env.JWT_SECRET = randomBytes(32).toString("hex");
process.env.TOTP_ENCRYPTION_KEY = randomBytes(32).toString("hex");
process.env.ADMIN_EMAIL = "integration-admin@example.test";
process.env.ADMIN_USERNAME = "integration_admin";
process.env.ADMIN_PASSWORD = randomBytes(32).toString("hex");

type Reply = { status: number; body: Record<string, any>; headers: Headers };
type Fixture = { id: string; username: string; email: string; token: string };
let app: INestApplication;
let pool: Pool;
let applicationPool: Pool;
let base: string;
let user: Fixture;
let authService: any;
let limits: any;
let security: any;
let jwt: any;
let passwordHash: string;
let originalFlag: { enabled: boolean; updated_at: Date } | undefined;
const password = randomBytes(24).toString("hex");
const fixtureIds: string[] = [];
const testSecrets = new Set<string>([password, process.env.JWT_SECRET, process.env.TOTP_ENCRYPTION_KEY]);
const context = (ip: string) => ({ ipAddress: ip, userAgent: "auth-integration" });
const compiled = (path: string) => import(new URL("../../dist/" + path + ".js", import.meta.url).href);
const expectStatus = (reply: Reply, status: number) => assert.equal(reply.status, status, "Unexpected HTTP status");
async function request(path: string, body?: Record<string, unknown>, token?: string, headers: Record<string, string> = {}): Promise<Reply> {
  const response = await fetch(base + path, {
    signal: AbortSignal.timeout(20_000),
    method: body === undefined ? "GET" : "POST",
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { authorization: "Bearer " + token } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() as Record<string, any>, headers: response.headers };
}
async function fixture(): Promise<Fixture> {
  const username = "auth_" + randomUUID().replaceAll("-", "");
  const email = username + "@example.test";
  const row = (await pool.query("insert into users(email,username,password_hash) values($1,$2,$3) returning id", [email, username, passwordHash])).rows[0];
  fixtureIds.push(row.id);
  const response = await request("/auth/login", { identifier: username, password });
  expectStatus(response, 201);
  assert.ok(typeof response.body.accessToken === "string", "Password login must issue an access token");
  return { id: row.id, username, email, token: response.body.accessToken };
}
async function reauth(purpose: string, who = user) {
  const response = await request("/auth/2fa/reauth", { password, purpose }, who.token);
  expectStatus(response, 201);
  assert.ok(typeof response.body.reauthToken === "string", "Expected reauthentication credential");
  assert.equal(response.headers.get("cache-control"), "no-store");
  testSecrets.add(response.body.reauthToken);
  return response.body.reauthToken as string;
}
async function setup(who = user) {
  const response = await request("/auth/2fa/setup", { reauthToken: await reauth("2fa-setup", who) }, who.token);
  expectStatus(response, 201);
  assert.ok(typeof response.body.secret === "string", "Expected enrollment secret");
  testSecrets.add(response.body.secret);
  return response.body as { secret: string; expiresAt: string };
}
async function totp(secret: string, offset = 0) {
  const value = await generate({ secret, algorithm: "sha1", digits: 6, period: 30, epoch: Math.floor(Date.now() / 1000) + offset });
  testSecrets.add(value);
  return value;
}
async function invalidTotp(secret: string) {
  const accepted = await Promise.all([-30, 0, 30].map((offset) => totp(secret, offset)));
  for (let n = 0; n < 100; n++) {
    const candidate = n.toString().padStart(6, "0");
    if (!accepted.includes(candidate)) return candidate;
  }
  throw new Error("Unable to choose an invalid OTP");
}
async function enroll() {
  const enrollment = await setup();
  const response = await request("/auth/2fa/enable", {
    reauthToken: await reauth("2fa-enable"), code: await totp(enrollment.secret),
  }, user.token);
  expectStatus(response, 201);
  const recoveryCodes = response.body.recoveryCodes as string[];
  assert.equal(recoveryCodes.length, 10);
  for (const code of recoveryCodes) testSecrets.add(code);
  user.token = response.body.accessToken;
  return { secret: enrollment.secret, recoveryCodes };
}
async function challenge() {
  const response = await request("/auth/login", { identifier: user.username, password });
  expectStatus(response, 201);
  assert.equal(response.body.twoFactorRequired, true);
  assert.ok(!("accessToken" in response.body), "Password-only step must not issue an access JWT");
  testSecrets.add(response.body.challengeToken);
  return response.body.challengeToken as string;
}
async function challengeRow(token: string) {
  return (await pool.query("select * from two_factor_login_challenges where token_hash=$1", [hashCredential(token)])).rows[0];
}
async function reauthRow(token: string) {
  return (await pool.query("select * from auth_reauth_tokens where token_hash=$1", [hashCredential(token)])).rows[0];
}
// Hold the real users row until both requests are waiting in different PostgreSQL
// backends. This verifies overlapping transactions rather than a single-client queue.
async function raceOnUser(actions: Array<() => Promise<Reply>>) {
  const blocker = await pool.connect();
  await blocker.query("begin");
  await blocker.query("select id from users where id=$1 for update", [user.id]);
  let pending: Promise<Reply>[] = [];
  let waiting = 0;
  try {
    pending = actions.map((action) => action());
    for (let i = 0; i < 200; i++) {
      // PostgreSQL caches activity snapshots for the transaction. Refresh before
      // polling so later-arriving blocked backends become visible.
      await blocker.query("select pg_stat_clear_snapshot()");
      const row = (await blocker.query("select count(distinct pid)::int as count from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and wait_event_type='Lock' and query ilike '%users%'")).rows[0];
      waiting = row.count;
      if (waiting >= actions.length) break;
      await delay(10);
    }
  } finally {
    await blocker.query("commit");
    blocker.release();
  }
  const results = await Promise.all(pending);
  assert.ok(waiting >= actions.length, "Both requests must overlap while blocked on the user row");
  return results;
}
function oneWinner(results: Reply[]) {
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 401).length, results.length - 1);
}

describe("v1.0.3 real PostgreSQL authentication integration", { concurrency: false }, () => {
  before(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
    const actual = (await pool.query("select current_database() as name")).rows[0].name;
    assert.equal("/" + actual, target.pathname, "Connected database must match the safe test target");
    // Verify migrations before booting the real application, including token storage.
    await pool.query("select token_hash,purpose,used_at from auth_reauth_tokens limit 0");
    originalFlag = (await pool.query("select enabled,updated_at from feature_flags where key='enable2FA'")).rows[0];
    const { AppModule } = await compiled("app.module");
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.listen(0, "127.0.0.1");
    base = (await app.getUrl()) + "/api";
    const { DB_POOL } = await compiled("db/database.module");
    applicationPool = app.get(DB_POOL);
    authService = app.get((await compiled("auth/auth.service")).AuthService);
    limits = app.get((await compiled("auth/auth-rate-limit.service")).AuthRateLimitService);
    security = app.get((await compiled("security/security-events.service")).SecurityEventsService);
    jwt = app.get(JwtService);
    passwordHash = await hash(password, 4);
  });
  beforeEach(async () => {
    await pool.query("insert into feature_flags(key,enabled) values('enable2FA',true) on conflict(key) do update set enabled=true");
    // Only reset the test server's loopback budgets, never any development state.
    const keys = ["password-ip", "2fa-login-ip"].map((scope) => hashCredential(scope + ":127.0.0.1"));
    await pool.query("delete from auth_rate_limits where key=any($1::text[])", [keys]);
    user = await fixture();
  });
  after(async () => {
    if (pool) {
      if (fixtureIds.length) {
        await pool.query("delete from wallets where user_id=any($1::uuid[])", [fixtureIds]);
        await pool.query("delete from security_events where actor_user_id=any($1::uuid[])", [fixtureIds]);
        await pool.query("delete from users where id=any($1::uuid[])", [fixtureIds]);
      }
      if (originalFlag) await pool.query("update feature_flags set enabled=$1,updated_at=$2 where key='enable2FA'", [originalFlag.enabled, originalFlag.updated_at]);
      else await pool.query("delete from feature_flags where key='enable2FA'");
    }
    if (app) await app.close();
    if (applicationPool) await applicationPool.end();
    if (pool) await pool.end();
  });

  test("non-2FA login, legacy JWT, register, logout, and me remain compatible", async () => {
    expectStatus(await request("/auth/me", undefined, user.token), 200);
    const legacy = await jwt.signAsync({ sub: user.id });
    expectStatus(await request("/auth/me", undefined, legacy), 200);
    expectStatus(await request("/auth/logout", {}, user.token), 201);
    const name = "register_" + randomUUID().replaceAll("-", "");
    const registered = await request("/auth/register", { email: name + "@example.test", username: name, password });
    expectStatus(registered, 201);
    fixtureIds.push(registered.body.user.id);
    expectStatus(await request("/auth/me", undefined, registered.body.accessToken), 200);
  });

  test("setup and activation encrypt secrets, hash recovery codes, and invalidate the previous session", async () => {
    const oldToken = user.token;
    const result = await enroll();
    const row = (await pool.query("select * from users where id=$1", [user.id])).rows[0];
    assert.equal(row.auth_version, 1);
    assert.equal(row.two_factor_enabled, true);
    assert.ok(row.totp_secret_encrypted !== result.secret);
    assert.ok(decryptTotp(row.totp_secret_encrypted, Buffer.from(process.env.TOTP_ENCRYPTION_KEY!, "hex"), user.id) === result.secret);
    assert.equal(row.totp_pending_encrypted, null);
    const codes = (await pool.query("select code_hash from two_factor_recovery_codes where user_id=$1", [user.id])).rows;
    assert.equal(codes.length, 10);
    assert.ok(codes.every((r) => /^[a-f0-9]{64}$/.test(r.code_hash) && !result.recoveryCodes.includes(r.code_hash)));
    expectStatus(await request("/auth/me", undefined, oldToken), 401);
    expectStatus(await request("/auth/me", undefined, user.token), 200);
  });

  test("invalid activation code does not enable 2FA or consume reauthentication", async () => {
    const enrollment = await setup();
    const token = await reauth("2fa-enable");
    expectStatus(await request("/auth/2fa/enable", { reauthToken: token, code: await invalidTotp(enrollment.secret) }, user.token), 401);
    assert.equal((await reauthRow(token)).used_at, null);
    assert.equal((await pool.query("select two_factor_enabled from users where id=$1", [user.id])).rows[0].two_factor_enabled, false);
    expectStatus(await request("/auth/2fa/enable", { reauthToken: token, code: await totp(enrollment.secret) }, user.token), 201);
  });

  test("JWT alone cannot authorize any sensitive 2FA operation", async () => {
    expectStatus(await request("/auth/2fa/setup", {}, user.token), 400);
    const activated = await enroll();
    for (const path of ["enable", "disable", "recovery-codes/regenerate"]) {
      expectStatus(await request("/auth/2fa/" + path, { code: activated.recoveryCodes[0] }, user.token), 400);
    }
    expectStatus(await request("/auth/2fa/setup", { reauthToken: randomBytes(32).toString("hex") }, user.token), 401);
  });

  test("password reauthentication rejects a wrong password and an invalid purpose", async () => {
    expectStatus(await request("/auth/2fa/reauth", { password: "DefinitelyWrong123!", purpose: "2fa-setup" }, user.token), 401);
    expectStatus(await request("/auth/2fa/reauth", { password, purpose: "login" }, user.token), 400);
  });

  for (const action of ["setup", "enable"] as const) {
    test(`ten concurrent 2FA ${action} requests complete with a saturated ten-connection PostgreSQL pool`, { timeout: 12_000 }, async () => {
      // Both paths read enable2FA while holding the user-row lock. Those reads
      // must use that transaction rather than acquiring an eleventh connection.
      applicationPool.options.max = 10;
      let body: Record<string, unknown>;
      if (action === "setup") body = { reauthToken: await reauth("2fa-setup") };
      else {
        const enrollment = await setup();
        body = { reauthToken: await reauth("2fa-enable"), code: await totp(enrollment.secret) };
      }
      const replies = await raceOnUser(Array.from({ length: 10 }, () => () => request(`/auth/2fa/${action}`, body, user.token)));
      oneWinner(replies);
      assert.equal(applicationPool.totalCount, 10);
      assert.equal(applicationPool.waitingCount, 0);
      const success = replies.find((r) => r.status === 201)!;
      if (action === "setup") testSecrets.add(success.body.secret);
      else for (const code of success.body.recoveryCodes) testSecrets.add(code);
      const scope = action === "setup" ? "2fa-setup" : "2fa-factor";
      assert.equal((await pool.query("select attempts from auth_rate_limits where key=$1", [hashCredential(scope + ":" + user.id)])).rows[0].attempts, 10);
      expectStatus(await request(`/auth/2fa/${action}`, body, user.token), action === "setup" ? 429 : 401);
    });
  }

  test("reauthentication is bound to the correct user and purpose", async () => {
    const other = await fixture();
    const token = await reauth("2fa-setup");
    expectStatus(await request("/auth/2fa/setup", { reauthToken: token }, other.token), 401);
    expectStatus(await request("/auth/2fa/enable", { reauthToken: token, code: "000000" }, user.token), 401);
    assert.equal((await reauthRow(token)).used_at, null);
    expectStatus(await request("/auth/2fa/setup", { reauthToken: token }, user.token), 201);
  });

  test("invalid and expired reauthentication cannot start enrollment", async () => {
    expectStatus(await request("/auth/2fa/setup", { reauthToken: randomBytes(32).toString("hex") }, user.token), 401);
    const token = await reauth("2fa-setup");
    await pool.query("update auth_reauth_tokens set expires_at=now()-interval '1 second' where token_hash=$1", [hashCredential(token)]);
    expectStatus(await request("/auth/2fa/setup", { reauthToken: token }, user.token), 401);
    assert.equal((await reauthRow(token)).used_at, null);
  });

  test("reauthentication is short-lived, hash-only, and single-use", async () => {
    const token = await reauth("2fa-setup");
    const row = await reauthRow(token);
    assert.ok(row.token_hash !== token);
    assert.ok(row.expires_at.getTime() <= Date.now() + 300_000 && row.expires_at.getTime() > Date.now());
    expectStatus(await request("/auth/2fa/setup", { reauthToken: token }, user.token), 201);
    assert.ok((await reauthRow(token)).used_at);
    expectStatus(await request("/auth/2fa/setup", { reauthToken: token }, user.token), 401);
  });

  test("concurrent reauthentication consumption: two PostgreSQL backends, exactly one winner", async () => {
    const token = await reauth("2fa-setup");
    oneWinner(await raceOnUser([
      () => request("/auth/2fa/setup", { reauthToken: token }, user.token),
      () => request("/auth/2fa/setup", { reauthToken: token }, user.token),
    ]));
    assert.ok((await reauthRow(token)).used_at);
  });

  test("password verification returns only a challenge for an enabled account", async () => {
    await enroll();
    const token = await challenge();
    assert.equal((await challengeRow(token)).attempts, 0);
    expectStatus(await request("/auth/me", undefined, token), 401);
    const passwordJwt = await jwt.signAsync({ sub: user.id, authVersion: 1, amr: "password" });
    expectStatus(await request("/auth/me", undefined, passwordJwt), 401);
  });

  test("expired login challenge is rejected without consuming a recovery code", async () => {
    const activated = await enroll();
    const token = await challenge();
    await pool.query("update two_factor_login_challenges set expires_at=now()-interval '1 second' where token_hash=$1", [hashCredential(token)]);
    expectStatus(await request("/auth/2fa/login", { challengeToken: token, code: activated.recoveryCodes[0] }), 401);
    assert.equal((await pool.query("select count(*)::int as n from two_factor_recovery_codes where user_id=$1 and used_at is not null", [user.id])).rows[0].n, 0);
  });

  test("login challenge is single-use and does not consume a second recovery code on replay", async () => {
    const activated = await enroll();
    const token = await challenge();
    expectStatus(await request("/auth/2fa/login", { challengeToken: token, code: activated.recoveryCodes[0] }), 201);
    expectStatus(await request("/auth/2fa/login", { challengeToken: token, code: activated.recoveryCodes[1] }), 401);
    assert.equal((await pool.query("select count(*)::int as n from two_factor_recovery_codes where user_id=$1 and used_at is not null", [user.id])).rows[0].n, 1);
  });

  test("concurrent login challenge consumption: two PostgreSQL backends, exactly one winner", async () => {
    const activated = await enroll();
    const token = await challenge();
    oneWinner(await raceOnUser(activated.recoveryCodes.slice(0, 2).map((code) => () => request("/auth/2fa/login", { challengeToken: token, code }))));
    assert.ok((await challengeRow(token)).used_at);
    assert.equal((await pool.query("select count(*)::int as n from two_factor_recovery_codes where user_id=$1 and used_at is not null", [user.id])).rows[0].n, 1);
  });

  test("recovery code cannot be reused with a fresh challenge", async () => {
    const activated = await enroll();
    expectStatus(await request("/auth/2fa/login", { challengeToken: await challenge(), code: activated.recoveryCodes[0] }), 201);
    expectStatus(await request("/auth/2fa/login", { challengeToken: await challenge(), code: activated.recoveryCodes[0] }), 401);
  });

  test("concurrent recovery use across login and regeneration: exactly one operation consumes it", async () => {
    const activated = await enroll();
    const token = await challenge();
    const reauthToken = await reauth("2fa-recovery-regenerate");
    oneWinner(await raceOnUser([
      () => request("/auth/2fa/login", { challengeToken: token, code: activated.recoveryCodes[0] }),
      () => request("/auth/2fa/recovery-codes/regenerate", { reauthToken, code: activated.recoveryCodes[0] }, user.token),
    ]));
  });

  test("TOTP replay is rejected after enrollment and after a successful login", async () => {
    const activated = await enroll();
    const row = (await pool.query("select totp_last_counter from users where id=$1", [user.id])).rows[0];
    const usedCode = await generate({ secret: activated.secret, epoch: row.totp_last_counter * 30, algorithm: "sha1", digits: 6, period: 30 });
    expectStatus(await request("/auth/2fa/login", { challengeToken: await challenge(), code: usedCode }), 401);
    // The next time step is inside the configured +/-30 second tolerance.
    const freshCode = await totp(activated.secret, 30);
    expectStatus(await request("/auth/2fa/login", { challengeToken: await challenge(), code: freshCode }), 201);
    expectStatus(await request("/auth/2fa/login", { challengeToken: await challenge(), code: freshCode }), 401);
  });

  test("challenge failures persist and the sixth guess is rejected even if the factor is valid", async () => {
    const activated = await enroll();
    const token = await challenge();
    const invalid = await invalidTotp(activated.secret);
    for (let n = 0; n < 5; n++) expectStatus(await request("/auth/2fa/login", { challengeToken: token, code: invalid }), 401);
    assert.equal((await challengeRow(token)).attempts, 5);
    expectStatus(await request("/auth/2fa/login", { challengeToken: token, code: activated.recoveryCodes[0] }), 401);
    assert.equal((await challengeRow(token)).attempts, 5);
  });

  test("disabling the feature flag blocks new setup and activation", async () => {
    const enrollment = await setup();
    const enableToken = await reauth("2fa-enable");
    const setupToken = await reauth("2fa-setup");
    await pool.query("update feature_flags set enabled=false where key='enable2FA'");
    expectStatus(await request("/auth/2fa/setup", { reauthToken: setupToken }, user.token), 403);
    expectStatus(await request("/auth/2fa/enable", { reauthToken: enableToken, code: await totp(enrollment.secret) }, user.token), 403);
  });

  test("existing enabled 2FA remains enforced with the feature flag off", async () => {
    const activated = await enroll();
    await pool.query("update feature_flags set enabled=false where key='enable2FA'");
    const response = await request("/auth/2fa/login", { challengeToken: await challenge(), code: activated.recoveryCodes[0] });
    expectStatus(response, 201);
    expectStatus(await request("/auth/me", undefined, response.body.accessToken), 200);
  });

  test("disable requires password plus a valid unused factor; failure rolls back reauth consumption", async () => {
    const activated = await enroll();
    const oldToken = user.token;
    const token = await reauth("2fa-disable");
    expectStatus(await request("/auth/2fa/disable", { reauthToken: token, code: await invalidTotp(activated.secret) }, user.token), 401);
    assert.equal((await reauthRow(token)).used_at, null);
    const response = await request("/auth/2fa/disable", { reauthToken: token, code: activated.recoveryCodes[0] }, user.token);
    expectStatus(response, 201);
    expectStatus(await request("/auth/me", undefined, oldToken), 401);
    expectStatus(await request("/auth/me", undefined, response.body.accessToken), 200);
    const row = (await pool.query("select auth_version,two_factor_enabled,totp_secret_encrypted from users where id=$1", [user.id])).rows[0];
    assert.equal(row.auth_version, 2);
    assert.equal(row.two_factor_enabled, false);
    assert.equal(row.totp_secret_encrypted, null);
    expectStatus(await request("/auth/login", { identifier: user.username, password }), 201);
  });

  test("recovery regeneration consumes reauth and invalidates every old recovery code", async () => {
    const activated = await enroll();
    const token = await reauth("2fa-recovery-regenerate");
    expectStatus(await request("/auth/2fa/recovery-codes/regenerate", { reauthToken: token, code: activated.recoveryCodes[0] }, user.token), 201);
    assert.ok((await reauthRow(token)).used_at);
    expectStatus(await request("/auth/2fa/recovery-codes/regenerate", { reauthToken: token, code: activated.recoveryCodes[1] }, user.token), 401);
    expectStatus(await request("/auth/2fa/login", { challengeToken: await challenge(), code: activated.recoveryCodes[1] }), 401);
  });

  test("enable and disable revoke outstanding reauthentication from earlier session versions", async () => {
    const stale = await reauth("2fa-disable");
    const activated = await enroll();
    assert.equal(await reauthRow(stale), undefined);
    expectStatus(await request("/auth/2fa/disable", { reauthToken: stale, code: activated.recoveryCodes[0] }, user.token), 401);
    const staleSetup = await reauth("2fa-setup");
    const response = await request("/auth/2fa/disable", { reauthToken: await reauth("2fa-disable"), code: activated.recoveryCodes[0] }, user.token);
    expectStatus(response, 201);
    assert.equal(await reauthRow(staleSetup), undefined);
  });

  test("password attempts are limited per account/IP without locking out another source", async () => {
    const attack = context("198.51.100.10");
    for (let n = 0; n < 10; n++) await assert.rejects(() => authService.login({ identifier: user.username, password: "WrongPassword123!" }, attack), (e: any) => e.getStatus() === 401);
    await assert.rejects(() => authService.login({ identifier: user.username, password }, attack), (e: any) => e.getStatus() === 429);
    const response = await authService.login({ identifier: user.username, password }, context("198.51.100.11"));
    assert.ok(response.accessToken, "Another source must still be able to authenticate");
    const other = await fixture();
    assert.ok((await authService.login({ identifier: other.username, password }, attack)).accessToken);
  });

  test("spoofed forwarding headers cannot bypass per-IP/account login limits", async () => {
    // fixture() already used one password attempt for this account/IP.
    for (let n = 0; n < 9; n++) expectStatus(await request("/auth/login", { identifier: user.username, password: "WrongPassword123!" }, undefined, { "x-forwarded-for": "203.0.113." + n, "x-real-ip": "198.51.100." + n }), 401);
    expectStatus(await request("/auth/login", { identifier: user.username, password }, undefined, { "x-forwarded-for": "192.0.2.99" }), 429);
  });

  test("unauthenticated requests cannot use reauthentication as a password-guessing oracle", async () => {
    expectStatus(await request("/auth/2fa/reauth", { password, purpose: "2fa-setup" }), 401);
    for (let n = 0; n < 10; n++) expectStatus(await request("/auth/2fa/reauth", { password: "WrongPassword123!", purpose: "2fa-setup" }, user.token), 401);
    expectStatus(await request("/auth/2fa/reauth", { password, purpose: "2fa-setup" }, user.token), 429);
  });

  test("database rate-limit increments remain atomic under concurrent requests", async () => {
    const scope = "integration-limit-" + randomUUID();
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => limits.check(scope, user.id, 5, 300)));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 5);
    assert.equal(results.filter((r) => r.status === "rejected").length, 15);
    const row = (await pool.query("select attempts from auth_rate_limits where key=$1", [hashCredential(scope + ":" + user.id)])).rows[0];
    assert.equal(row.attempts, 20);
  });

  test("cleanup removes expired records and retains live rate-limit and reauth records", async () => {
    const old = hashCredential("old:" + user.id), live = hashCredential("live:" + user.id);
    await pool.query("insert into auth_rate_limits(key,window_start,attempts) values($1,now()-interval '26 hours',1),($2,now(),1)", [old, live]);
    const token = await reauth("2fa-setup");
    const expired = await reauth("2fa-enable");
    await pool.query("update auth_reauth_tokens set expires_at=now()-interval '26 hours' where token_hash=$1", [hashCredential(expired)]);
    await limits.cleanupExpired();
    assert.equal((await pool.query("select count(*)::int as n from auth_rate_limits where key=$1", [old])).rows[0].n, 0);
    assert.equal((await pool.query("select count(*)::int as n from auth_rate_limits where key=$1", [live])).rows[0].n, 1);
    assert.equal(await reauthRow(expired), undefined);
    assert.ok(await reauthRow(token));
  });

  test("persisted security events and public APIs redact all tested secret types", async () => {
    const token = await reauth("2fa-setup");
    await security.recordEvent({
      actorUserId: user.id, eventType: "TWO_FACTOR_SETUP_FAILED", severity: "WARNING",
      metadata: { password, code: "123456", totpSecret: newTotpSecret(), recoveryCodes: ["deadbeef-deadbeef-deadbeef-deadbeef"], reauthToken: token, nested: { challengeToken: token }, safe: "preserve" },
    }, { swallowErrors: false });
    const record = (await pool.query("select metadata from security_events where actor_user_id=$1 and event_type='TWO_FACTOR_SETUP_FAILED' order by created_at desc limit 1", [user.id])).rows[0].metadata;
    for (const key of ["password", "code", "totpSecret", "recoveryCodes", "reauthToken"]) assert.equal(record[key], "[REDACTED]");
    assert.equal(record.nested.challengeToken, "[REDACTED]");
    assert.equal(record.safe, "preserve");
    const serialized = JSON.stringify((await pool.query("select metadata from security_events where actor_user_id=any($1::uuid[])", [fixtureIds])).rows);
    assert.ok([...testSecrets].every((secret) => !serialized.includes(secret)), "Security event metadata must not contain credentials");
    const me = await request("/auth/me", undefined, user.token);
    expectStatus(me, 200);
    for (const key of ["passwordHash", "totpSecretEncrypted", "totpPendingEncrypted", "recoveryCodes", "reauthToken"]) assert.ok(!(key in me.body.user));
  });

  test("ciphertext is bound to user and authenticated against tampering", () => {
    const key = randomBytes(32), secret = newTotpSecret();
    const encrypted = encryptTotp(secret, key, user.id);
    assert.ok(decryptTotp(encrypted, key, user.id) === secret);
    assert.throws(() => decryptTotp(encrypted, key, randomUUID()));
    assert.throws(() => decryptTotp(encrypted, randomBytes(32), user.id));
  });
});
