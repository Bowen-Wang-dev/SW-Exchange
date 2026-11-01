import "reflect-metadata";
import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { before, beforeEach, after, afterEach, describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "dotenv";
import { Controller, Get, Module, ValidationPipe, type INestApplication } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { NestFactory, ModulesContainer } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hash } from "bcryptjs";
import { generate } from "otplib";
import { Pool } from "pg";
import { ADMIN_PERMISSIONS, ADMIN_ROLE_DEFINITIONS, ADMIN_REPORT_PERMISSIONS } from "@sw-exchange/shared";
import { hashCredential, encryptTotp, newTotpSecret, newRecoveryCodes, recoveryHash } from "../auth/two-factor.crypto.js";

const root = new URL("../../../../", import.meta.url);
function envFile(name: string) { const p = fileURLToPath(new URL(name, root)); return existsSync(p) ? parse(readFileSync(p)) : {}; }
const databaseUrl = process.env.DATABASE_URL_TEST ?? envFile(".env.test.local").DATABASE_URL_TEST;
if (!databaseUrl) throw new Error("DATABASE_URL_TEST is required; RBAC tests cannot be skipped.");
const target = new URL(databaseUrl);
function identity(value: string) { const u = new URL(value); return (u.hostname === "localhost" ? "127.0.0.1" : u.hostname) + ":" + (u.port || "5432") + u.pathname; }
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || !/_test(?:_|$)/.test(target.pathname)) throw new Error("RBAC tests require an explicitly named local test database.");
for (const value of [envFile(".env").DATABASE_URL, envFile(".env.production").DATABASE_URL]) if (value && identity(value) === identity(databaseUrl)) throw new Error("Refusing a development/production database.");
if (process.env.DATABASE_URL && process.env.DATABASE_URL !== databaseUrl && identity(process.env.DATABASE_URL) === identity(databaseUrl)) throw new Error("Ambiguous database identity.");
process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = "test";
process.env.PGOPTIONS = "-c statement_timeout=15000 -c lock_timeout=5000";
process.env.JWT_SECRET = randomBytes(32).toString("hex");
process.env.TOTP_ENCRYPTION_KEY = randomBytes(32).toString("hex");
process.env.ADMIN_EMAIL ??= "rbac-admin@example.test";
process.env.ADMIN_USERNAME ??= "rbac_admin";
process.env.ADMIN_PASSWORD ??= randomBytes(24).toString("hex");
const compiled = (path: string) => import(new URL("../../dist/" + path + ".js", import.meta.url).href);
const password = randomBytes(24).toString("hex");
type Fixture = { id: string; token: string; username: string };
type Reply = { status: number; body: any; headers: Headers };
let app: INestApplication, pool: Pool, applicationPool: Pool, jwt: JwtService, base: string, passwordHash: string;
let superAdmin: Fixture, viewer: Fixture, operator: Fixture, ordinary: Fixture;
let ids: string[] = [];
let assetIds: string[] = [], marketIds: string[] = [];
let config: ConfigService;
let originalFlag: any;
const secrets = new Set([password, process.env.JWT_SECRET, process.env.TOTP_ENCRYPTION_KEY]);
async function request(path: string, token?: string, method = "GET", body?: unknown, headers: Record<string, string> = {}): Promise<Reply> {
  const r = await fetch(base + path, { method, signal: AbortSignal.timeout(20_000), headers: { ...(token ? { authorization: "Bearer " + token } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: r.status, body: await r.json(), headers: r.headers };
}
function status(reply: Reply, expected: number) { assert.equal(reply.status, expected, "Unexpected HTTP status: " + reply.body?.message); }
async function fixture(roles: string[] = [], legacy = false) {
  const username = "rbac_" + randomUUID().replaceAll("-", "");
  const row = (await pool.query("insert into users(email,username,password_hash,role) values($1,$2,$3,$4) returning id", [username + "@example.test", username, passwordHash, roles.length || legacy ? "ADMIN" : "USER"])).rows[0];
  ids.push(row.id);
  for (const role of roles) await pool.query("insert into user_admin_roles(user_id,role_key) values($1,$2)", [row.id, role]);
  return { id: row.id, username, token: await jwt.signAsync({ sub: row.id, authVersion: 0 }) };
}
async function flag(enabled: boolean) { await pool.query("insert into feature_flags(key,enabled) values('enableAdminRolePermissions',$1) on conflict(key) do update set enabled=$1", [enabled]); }
async function reauth(actor: Fixture, targetId: string, roles: string[], extra: object = {}) {
  const r = await request(`/admin/users/${targetId}/roles/reauth`, actor.token, "POST", { roles, password, ...extra });
  status(r, 201); assert.equal(r.headers.get("cache-control"), "no-store"); secrets.add(r.body.reauthToken); return r.body.reauthToken as string;
}
async function assign(actor: Fixture, person: Fixture, roles: string[], proof?: string) {
  return request(`/admin/users/${person.id}/roles`, actor.token, "PUT", { roles, reauthToken: proof ?? await reauth(actor, person.id, roles) });
}
async function activeSupers() { return (await pool.query("select u.id from users u join user_admin_roles r on r.user_id=u.id where u.role='ADMIN' and u.status='ACTIVE' and not u.is_system and r.role_key='super_admin'")).rows; }
async function race(actions: Array<() => Promise<Reply>>) {
  const blocker = await pool.connect(); await blocker.query("begin"); await blocker.query("select pg_advisory_xact_lock(1040004)");
  let pending: Promise<Reply>[] = [], waiting = 0;
  try {
    pending = actions.map((f) => f());
    for (let n = 0; n < 200; n++) {
      await blocker.query("select pg_stat_clear_snapshot()");
      waiting = (await blocker.query("select count(distinct pid)::int as n from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and wait_event_type='Lock' and query ilike '%pg_advisory_xact_lock%'")).rows[0].n;
      if (waiting >= actions.length) break;
      await delay(10);
    }
  } finally { await blocker.query("commit"); blocker.release(); }
  const results = await Promise.all(pending);
  assert.ok(waiting >= actions.length, "Independent PostgreSQL backends must overlap on the administrative lock");
  return results;
}

async function withFeePrincipal(who: Fixture, run: () => Promise<void>) {
  const original = config.getOrThrow<string>("ADMIN_EMAIL");
  const email = (await pool.query("select email from users where id=$1", [who.id])).rows[0].email;
  config.set("ADMIN_EMAIL", email);
  try { await run(); } finally { config.set("ADMIN_EMAIL", original); }
}
async function isolatedMarket() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const symbols = ["R" + suffix + "B", "R" + suffix + "Q"];
  for (const symbol of symbols) {
    const r = await request("/admin/assets", operator.token, "POST", { symbol, name: "Isolated authorization fixture", decimals: 2 });
    status(r, 201); assetIds.push(r.body.id);
  }
  const market = await request("/admin/markets", operator.token, "POST", { baseAssetSymbol: symbols[0], quoteAssetSymbol: symbols[1], pricePrecision: 2, amountPrecision: 2, minOrderAmount: "0.01", minNotional: "0.01" });
  status(market, 201); marketIds.push(market.body.id);
  return { id: market.body.id as string, symbol: symbols.join("/"), base: symbols[0]!, quote: symbols[1]!, baseId: assetIds[0]!, quoteId: assetIds[1]! };
}
async function queuedRace(first: () => Promise<Reply>, second: () => Promise<Reply>) {
  const blocker = await pool.connect(); await blocker.query("begin"); await blocker.query("select pg_advisory_xact_lock(1040004)");
  const pending: Promise<Reply>[] = [];
  try {
    for (const action of [first, second]) {
      pending.push(action()); let waiting = 0;
      for (let n = 0; n < 200; n++) {
        await blocker.query("select pg_stat_clear_snapshot()");
        waiting = (await blocker.query("select count(distinct pid)::int n from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and wait_event_type='Lock' and query ilike '%pg_advisory_xact_lock%'")).rows[0].n;
        if (waiting >= pending.length) break;
        await delay(10);
      }
      assert.ok(waiting >= pending.length, "Each independent backend must queue before the next request starts");
    }
  } finally { await blocker.query("commit"); blocker.release(); }
  return Promise.all(pending);
}

// Use the application's real bounded pool and a separate blocker/observer pool.
// Fill every connection with a transaction waiting for the same user row before
// releasing it. Nested pooled reads would then starve the lock holder.
async function saturatedUserRace(userId: string, actions: Array<() => Promise<Reply>>) {
  const blocker = await pool.connect();
  await blocker.query("begin");
  await blocker.query("select id from users where id=$1 for update", [userId]);
  let pending: Promise<Reply>[] = [], waiting = 0;
  try {
    pending = actions.map((action) => action());
    for (let n = 0; n < 300; n++) {
      await blocker.query("select pg_stat_clear_snapshot()");
      // Full users projections can exceed track_activity_query_size before
      // their FOR UPDATE suffix; the lock wait and users table identify them.
      waiting = (await blocker.query("select count(distinct pid)::int n from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and wait_event_type='Lock' and query ilike '%users%'")).rows[0].n;
      if (waiting === actions.length) break;
      await delay(10);
    }
  } finally { await blocker.query("commit"); blocker.release(); }
  const results = await Promise.all(pending);
  assert.equal(waiting, actions.length, "All bounded-pool connections must overlap on the real user-row lock");
  assert.equal(applicationPool.waitingCount, 0, "No pool acquisition may remain queued");
  assert.ok(results.every((r) => r.status !== 500), "Pool contention must never produce HTTP 500");
  return results;
}

describe("v1.0.4 real HTTP/PostgreSQL administrative authorization", { concurrency: false }, () => {
  before(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 10 });
    assert.equal("/" + (await pool.query("select current_database() as n")).rows[0].n, target.pathname);
    await pool.query("select user_id,role_key from user_admin_roles limit 0");
    originalFlag = (await pool.query("select enabled,updated_at from feature_flags where key='enableAdminRolePermissions'")).rows[0];
    const { AppModule } = await compiled("app.module");
    const { Public } = await compiled("common/decorators/public.decorator");
    @Controller("admin/policy-probe") class PolicyProbe { @Public() @Get() missing() { return { exposed: true }; } }
    @Module({ imports: [AppModule], controllers: [PolicyProbe] }) class TestModule {}
    app = await NestFactory.create(TestModule, { logger: false }); app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.listen(0, "127.0.0.1"); base = await app.getUrl() + "/api";
    config = app.get(ConfigService);
    applicationPool = app.get((await compiled("db/database.module")).DB_POOL); jwt = app.get(JwtService); passwordHash = await hash(password, 4);
  });
  beforeEach(async () => {
    ids = []; assetIds = []; marketIds = []; await flag(true);
    await pool.query("delete from auth_rate_limits where key=$1", [hashCredential("password-ip:127.0.0.1")]);
    superAdmin = await fixture(["super_admin"]); viewer = await fixture(["viewer"]); operator = await fixture(["operator"]); ordinary = await fixture();
  });
  afterEach(async () => {
    if (marketIds.length) {
      await pool.query("delete from trades where market_id=any($1::uuid[])", [marketIds]);
      await pool.query("delete from orders where market_id=any($1::uuid[])", [marketIds]);
      await pool.query("delete from fee_settings where market_id=any($1::uuid[])", [marketIds]);
      await pool.query("delete from markets where id=any($1::uuid[])", [marketIds]);
    }
    if (assetIds.length) {
      await pool.query("delete from ledger_entries where asset_id=any($1::uuid[])", [assetIds]);
      await pool.query("delete from wallets where asset_id=any($1::uuid[])", [assetIds]);
      await pool.query("delete from assets where id=any($1::uuid[])", [assetIds]);
    }
    if (ids.length) {
      await pool.query("delete from admin_audit_logs where admin_user_id=any($1::uuid[])", [ids]);
      await pool.query("delete from wallets where user_id=any($1::uuid[])", [ids]);
      await pool.query("delete from security_events where actor_user_id=any($1::uuid[])", [ids]);
      await pool.query("delete from users where id=any($1::uuid[])", [ids]);
    }
  });
  after(async () => {
    if (originalFlag) await pool.query("update feature_flags set enabled=$1,updated_at=$2 where key='enableAdminRolePermissions'", [originalFlag.enabled, originalFlag.updated_at]);
    else await pool.query("delete from feature_flags where key='enableAdminRolePermissions'");
    if (app) await app.close(); if (applicationPool) await applicationPool.end(); if (pool) await pool.end();
  });

  test("unauthenticated and ordinary accounts are rejected on every admin surface, including legacy /users", async () => {
    for (const enabled of [true,false]) {
      await flag(enabled);
      for (const path of ["/admin", "/admin/users", "/admin/roles", "/admin/permissions", "/admin/feature-flags", "/admin/security-events", "/users"]) {
        status(await request(path), 401); status(await request(path, ordinary.token), 403);
      }
      status(await request(`/admin/users/${ordinary.id}/roles`, ordinary.token, "PUT", { roles: ["super_admin"], reauthToken: "a".repeat(64) }),403);
    }
  });
  test("viewer can read every explicitly permitted resource", async () => {
    for (const path of ["/admin", "/admin/reports/summary", "/admin/users", "/admin/wallets", "/admin/wallet", "/admin/system-wallets", "/admin/ledger", "/admin/transfers", "/admin/orders", "/admin/trades", "/admin/fee-settings", "/admin/audit-logs", "/admin/feature-flags", "/admin/feature-flags/enableAdminRolePermissions", "/admin/security-events", "/admin/security-actions", "/admin/roles", "/admin/permissions", "/admin/capabilities", `/admin/users/${ordinary.id}/roles`, "/users"]) status(await request(path, viewer.token),200);
    status(await request("/assets", viewer.token),200); status(await request("/markets", viewer.token),200);
  });
  test("viewer cannot mutate users, fees, wallets, airdrops, assets, markets or roles", async () => {
    for (const [method,path] of [["PATCH",`/admin/users/${ordinary.id}/status`],["PATCH","/admin/fee-settings"],["POST","/admin/fee-settings"],["POST","/admin/wallet-buckets/transfer"],["POST","/admin/airdrop"],["POST","/admin/assets"],["PATCH","/admin/assets/SWC/status"],["PATCH","/admin/assets/SWC/metadata"],["POST","/admin/markets"],["PATCH","/admin/markets/SWL%2FSWC/status"],["PUT",`/admin/users/${ordinary.id}/roles`],["POST",`/admin/users/${ordinary.id}/roles/reauth`]]) status(await request(path!,viewer.token,method,{}),403);
  });
  test("operator registry is exact, allows ordinary user controls and excludes financial/role mutations", async () => {
    const r=await request("/admin/capabilities",operator.token);status(r,200);
    assert.deepEqual([...r.body.permissions].sort(),[...ADMIN_ROLE_DEFINITIONS.find(r=>r.key==="operator")!.permissions].sort());
    status(await request(`/admin/users/${ordinary.id}/status`,operator.token,"PATCH",{status:"FROZEN"}),200);
    for(const [method,path] of [["PATCH","/admin/fee-settings"],["POST","/admin/wallet-buckets/transfer"],["POST","/admin/airdrop"],["PUT",`/admin/users/${ordinary.id}/roles`]])status(await request(path!,operator.token,method,{}),403);
  });
  test("super-admin has the exact full explicit registry and can assign and remove multiple roles", async()=>{
    const c=await request("/admin/capabilities",superAdmin.token);status(c,200);assert.deepEqual([...c.body.permissions].sort(),[...ADMIN_PERMISSIONS].sort());
    status(await assign(superAdmin,ordinary,["viewer","operator"]),200);
    const current=await request(`/admin/users/${ordinary.id}/roles`,superAdmin.token);status(current,200);assert.deepEqual(current.body.roles,["operator","viewer"]);assert.equal(current.body.user.role,"ADMIN");
    status(await assign(superAdmin,ordinary,[]),200);assert.equal((await pool.query("select role from users where id=$1",[ordinary.id])).rows[0].role,"USER");
  });
  test("role management remains restricted with rollout flag disabled",async()=>{
    await flag(false);status(await request("/admin/fee-settings",viewer.token),200);
    // Assigned least-privilege roles stay constrained in legacy rollout mode.
    status(await request(`/admin/users/${ordinary.id}/status`,viewer.token,"PATCH",{status:"FROZEN"}),403);
    status(await request(`/admin/users/${ordinary.id}/roles/reauth`,viewer.token,"POST",{roles:["super_admin"],password}),403);
    status(await assign(superAdmin,ordinary,["viewer"]),200);
  });
  test("legacy ADMIN without assignments keeps disabled-flag access but fails closed when enabled",async()=>{
    const legacy=await fixture([],true);await flag(false);status(await request("/admin/users",legacy.token),200);
    status(await request(`/admin/users/${ordinary.id}/roles`,legacy.token,"PUT",{}),403);
    await flag(true);status(await request("/admin/users",legacy.token),403);
  });
  test("missing permission metadata fails closed even with @Public and with either flag state",async()=>{
    for(const enabled of [false,true]){await flag(enabled);status(await request("/admin/policy-probe"),401);status(await request("/admin/policy-probe",superAdmin.token),403);}
  });
  test("route inventory requires explicit valid method policies for every administrative route",async()=>{
    const {ADMIN_POLICY}=await compiled("admin-roles/admin-permissions.decorator");let count=0;
    for(const module of app.get(ModulesContainer).values()) for(const wrapper of module.controllers.values()){
      const type=wrapper.metatype;if(!type)continue;const prefix=Reflect.getMetadata(PATH_METADATA,type)??"";
      for(const name of Object.getOwnPropertyNames(type.prototype)){
        const method: Function = type.prototype[name];if(typeof method!=="function"||Reflect.getMetadata(METHOD_METADATA,method)===undefined)continue;
        const roles=Reflect.getMetadata("roles",method)??Reflect.getMetadata("roles",type)??[];
        if(!String(prefix).startsWith("admin")&&!roles.includes("ADMIN"))continue;
        if(prefix==="admin/policy-probe")continue;
        const p: { permissions: typeof ADMIN_PERMISSIONS[number][]; always: boolean } | undefined = Reflect.getMetadata(ADMIN_POLICY,method);assert.ok(p?.permissions?.length,`${type.name}.${name} requires policy`);
        for(const permission of p!.permissions)assert.ok(ADMIN_PERMISSIONS.includes(permission),`${type.name}.${name} unknown policy`);
        if(["setRoles","reauth"].includes(name)&&type.name==="AdminRolesController")assert.equal(p!.always,true);
        count++;
      }
    }
    assert.equal(count,34,"Update the reviewed route inventory when adding routes");
  });
  test("self role changes and self privilege escalation are rejected and audited",async()=>{
    const second=await fixture(["super_admin"]);
    status(await assign(superAdmin,superAdmin,["operator"]),403);
    status(await request(`/admin/users/${viewer.id}/roles`,viewer.token,"PUT",{roles:["super_admin"],reauthToken:"a".repeat(64)}),403);
    assert.ok((await pool.query("select id from security_events where actor_user_id=$1 and event_type='ADMIN_PRIVILEGE_ESCALATION_REJECTED'",[superAdmin.id])).rowCount);
    const denied=(await pool.query("select target_id,metadata from security_events where actor_user_id=$1 and event_type='ADMIN_ACCESS_DENIED'",[viewer.id])).rows[0];assert.equal(denied.target_id,viewer.id);assert.ok(denied.metadata.operation.includes("PUT"));
    assert.equal((await activeSupers()).length,2);
  });
  test("last active super-admin cannot lose its role even when other ACTIVE admins exist",async()=>{
    status(await assign(superAdmin,superAdmin,[]),403);
    assert.equal((await activeSupers()).length,1);
    assert.equal((await pool.query("select count(*)::int n from security_events where actor_user_id=$1 and event_type='ADMIN_LAST_SUPER_ADMIN_PROTECTED'",[superAdmin.id])).rows[0].n,1);
  });
  test("operator cannot suspend/reactivate administrators regardless of rollout mode",async()=>{
    for(const enabled of [false,true]){await flag(enabled);status(await request(`/admin/users/${superAdmin.id}/status`,operator.token,"PATCH",{status:"FROZEN"}),403);}
    assert.equal((await activeSupers()).length,1);
  });
  test("super-admin cannot suspend the final active super-admin",async()=>{
    // A generic 403 could come from self-suspension. Require the invariant's
    // exact response and dedicated audit event, then test its DB predicate with
    // a distinct target (the shipped registry grants management only to supers).
    const rejected = await request(`/admin/users/${superAdmin.id}/status`,superAdmin.token,"PATCH",{status:"FROZEN"});
    status(rejected,403); assert.equal(rejected.body.message,"Cannot remove or suspend the last active super-admin.");
    assert.equal((await pool.query("select count(*)::int n from security_events where actor_user_id=$1 and event_type='ADMIN_LAST_SUPER_ADMIN_PROTECTED'",[superAdmin.id])).rows[0].n,1);
    const target = await fixture(["super_admin"]);
    await pool.query("delete from user_admin_roles where user_id=$1",[superAdmin.id]);
    const { AdminRolesService } = await compiled("admin-roles/admin-roles.service");
    const { DRIZZLE_DB } = await compiled("db/database.module");
    await assert.rejects(app.get(DRIZZLE_DB).transaction((tx: any) => app.get(AdminRolesService).assertAnotherSuper(tx,target.id)), /last active super-admin/);
    assert.equal((await pool.query("select status from users where id=$1",[target.id])).rows[0].status,"ACTIVE");
    assert.equal((await activeSupers()).length,1);
  });
  test("concurrent reciprocal demotions leave one active super-admin and reject the stale actor",async()=>{
    const second=await fixture(["super_admin"]);const a=await reauth(superAdmin,second.id,[]),b=await reauth(second,superAdmin.id,[]);
    const results=await race([()=>assign(superAdmin,second,[],a),()=>assign(second,superAdmin,[],b)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);assert.equal((await activeSupers()).length,1);
  });
  test("concurrent suspension and demotion preserve the active super-admin invariant",async()=>{
    const second=await fixture(["super_admin"]);const proof=await reauth(second,superAdmin.id,[]);
    const results=await race([()=>assign(second,superAdmin,[],proof),()=>request(`/admin/users/${second.id}/status`,superAdmin.token,"PATCH",{status:"FROZEN"})]);
    assert.equal(results.filter(r=>r.status===200).length,1);assert.ok(results.some(r=>[401,403].includes(r.status)));assert.equal((await activeSupers()).length,1);
  });
  test("concurrent use of the same role proof has exactly one winner",async()=>{
    const proof=await reauth(superAdmin,ordinary.id,["viewer"]);
    const results=await race([()=>assign(superAdmin,ordinary,["viewer"],proof),()=>assign(superAdmin,ordinary,["viewer"],proof)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);
    assert.equal((await pool.query("select auth_version from users where id=$1",[ordinary.id])).rows[0].auth_version,1);
  });
  test("demotion revokes previous JWTs and login challenges without affecting unrelated users",async()=>{
    await pool.query("insert into two_factor_login_challenges(user_id,token_hash,auth_version,expires_at) values($1,$2,0,now()+interval '5 minutes')",[operator.id,hashCredential(randomBytes(32).toString("hex"))]);
    status(await assign(superAdmin,operator,["viewer"]),200);
    status(await request("/admin/users",operator.token),401);status(await request("/auth/me",ordinary.token),200);
    assert.equal((await pool.query("select count(*)::int n from two_factor_login_challenges where user_id=$1",[operator.id])).rows[0].n,0);
    const login=await request("/auth/login",undefined,"POST",{identifier:operator.username,password});status(login,201);
    status(await request(`/admin/users/${ordinary.id}/status`,login.body.accessToken,"PATCH",{status:"FROZEN"}),403);
  });
  test("complete admin removal stays removed after disabling granular enforcement",async()=>{
    status(await assign(superAdmin,operator,[]),200);await flag(false);status(await request("/admin/users",operator.token),401);
    const login=await request("/auth/login",undefined,"POST",{identifier:operator.username,password});status(login,201);status(await request("/admin/users",login.body.accessToken),403);
  });
  test("removing empty assignments from an unassigned legacy ADMIN still revokes base authority",async()=>{
    const legacy=await fixture([],true);await flag(false);status(await request("/admin/users",legacy.token),200);
    const changed=await assign(superAdmin,legacy,[]);status(changed,200);assert.equal(changed.body.changed,true);
    const row=(await pool.query("select role,auth_version from users where id=$1",[legacy.id])).rows[0];assert.equal(row.role,"USER");assert.equal(row.auth_version,1);
    status(await request("/admin/users",legacy.token),401);
    const event=(await pool.query("select metadata from security_events where actor_user_id=$1 and target_id=$2 and event_type='ADMIN_ROLES_UPDATED'",[superAdmin.id,legacy.id])).rows[0];assert.equal(event.metadata.beforeBaseRole,"ADMIN");assert.equal(event.metadata.afterBaseRole,"USER");
  });
  test("unchanged roles consume fresh proof without unnecessarily revoking target sessions",async()=>{
    const proof=await reauth(superAdmin,viewer.id,["viewer"]);const response=await assign(superAdmin,viewer,["viewer"],proof);status(response,200);assert.equal(response.body.changed,false);
    status(await request("/admin/users",viewer.token),200);status(await assign(superAdmin,viewer,["viewer"],proof),401);
    assert.equal((await pool.query("select auth_version from users where id=$1",[viewer.id])).rows[0].auth_version,0);
  });
  test("admin suspension revokes sessions; reactivation does not resurrect them",async()=>{
    const second=await fixture(["super_admin"]);
    status(await request(`/admin/users/${operator.id}/status`,superAdmin.token,"PATCH",{status:"FROZEN"}),200);
    status(await request("/admin/users",operator.token),401);
    const frozen=await request("/auth/login",undefined,"POST",{identifier:operator.username,password});status(frozen,201);status(await request("/admin/users",frozen.body.accessToken),403);
    status(await request(`/admin/users/${operator.id}/status`,second.token,"PATCH",{status:"ACTIVE"}),200);status(await request("/admin/users",frozen.body.accessToken),401);
  });
  test("unknown/duplicate roles, permissions and profile-role injection are rejected",async()=>{
    for(const roles of [["unknown"],["super_admin","super_admin"]])status(await request(`/admin/users/${ordinary.id}/roles`,superAdmin.token,"PUT",{roles,reauthToken:"a".repeat(64)}),400);
    status(await request(`/admin/users/${ordinary.id}/roles`,superAdmin.token,"PUT",{roles:["viewer"],permissions:["*"],reauthToken:"a".repeat(64)}),400);
    status(await request(`/admin/users/${ordinary.id}/status`,superAdmin.token,"PATCH",{status:"ACTIVE",role:"ADMIN",adminRoles:["super_admin"]}),400);
    status(await request("/auth/register",undefined,"POST",{email:"injection@example.test",username:"injection",password,role:"ADMIN"}),400);
    assert.equal((await pool.query("select role from users where id=$1",[ordinary.id])).rows[0].role,"USER");
  });
  test("fresh password required; JWT-only, wrong-purpose and expired proof cannot mutate roles",async()=>{
    status(await request(`/admin/users/${ordinary.id}/roles/reauth`,superAdmin.token,"POST",{roles:["viewer"],password:"incorrect-password"}),401);
    status(await assign(superAdmin,ordinary,["viewer"],"a".repeat(64)),401);
    const proof=await reauth(superAdmin,ordinary.id,["viewer"]);
    status(await assign(superAdmin,ordinary,["operator"],proof),401);status(await assign(superAdmin,viewer,["viewer"],proof),401);
    await pool.query("update auth_reauth_tokens set expires_at=now()-interval '1 second' where token_hash=$1",[hashCredential(proof)]);
    status(await assign(superAdmin,ordinary,["viewer"],proof),401);
    assert.equal((await pool.query("select role from users where id=$1",[ordinary.id])).rows[0].role,"USER");
  });
  test("role proof is single-use and a failed mutation rolls back its consumption",async()=>{
    const second=await fixture(["super_admin"]);const proof=await reauth(superAdmin,superAdmin.id,["viewer"]);
    status(await assign(superAdmin,superAdmin,["viewer"],proof),403);
    assert.equal((await pool.query("select used_at from auth_reauth_tokens where token_hash=$1",[hashCredential(proof)])).rows[0].used_at,null);
    const valid=await reauth(superAdmin,ordinary.id,["viewer"]);status(await assign(superAdmin,ordinary,["viewer"],valid),200);status(await assign(superAdmin,ordinary,["viewer"],valid),401);
  });
  test("enrolled admins must supply a fresh second factor even if enable2FA is disabled",async()=>{
    const secret=newTotpSecret();secrets.add(secret);
    await pool.query("update users set two_factor_enabled=true,totp_secret_encrypted=$2 where id=$1",[superAdmin.id,encryptTotp(secret,Buffer.from(process.env.TOTP_ENCRYPTION_KEY!,"hex"),superAdmin.id)]);
    superAdmin.token=await jwt.signAsync({sub:superAdmin.id,authVersion:0,amr:"mfa"});
    status(await request(`/admin/users/${ordinary.id}/roles/reauth`,superAdmin.token,"POST",{roles:["viewer"],password}),401);
    const code=await generate({secret,algorithm:"sha1",digits:6,period:30});secrets.add(code);
    const proof=await reauth(superAdmin,ordinary.id,["viewer"],{code});status(await assign(superAdmin,ordinary,["viewer"],proof),200);
    status(await request(`/admin/users/${viewer.id}/roles/reauth`,superAdmin.token,"POST",{roles:["operator"],password,code}),401);
  });
  test("role reauthentication recovery factors are single-use and emit recovery-use events",async()=>{
    const code=newRecoveryCodes()[0]!;secrets.add(code);
    await pool.query("update users set two_factor_enabled=true where id=$1",[superAdmin.id]);
    await pool.query("insert into two_factor_recovery_codes(user_id,code_hash) values($1,$2)",[superAdmin.id,recoveryHash(superAdmin.id,code)]);
    superAdmin.token=await jwt.signAsync({sub:superAdmin.id,authVersion:0,amr:"mfa"});
    const proof=await reauth(superAdmin,ordinary.id,["viewer"],{code});status(await assign(superAdmin,ordinary,["viewer"],proof),200);
    status(await request(`/admin/users/${viewer.id}/roles/reauth`,superAdmin.token,"POST",{roles:["operator"],password,code}),401);
    assert.equal((await pool.query("select count(*)::int n from security_events where actor_user_id=$1 and event_type='TWO_FACTOR_RECOVERY_USED'",[superAdmin.id])).rows[0].n,1);
  });
  test("database-only grants cannot exceed the reviewed registry",async()=>{
    await pool.query("insert into admin_role_permissions(role_key,permission_key) values('operator','admin_roles.manage') on conflict do nothing");
    try {status(await request(`/admin/users/${ordinary.id}/roles/reauth`,operator.token,"POST",{roles:["super_admin"],password}),403);}
    finally {await pool.query("delete from admin_role_permissions where role_key='operator' and permission_key='admin_roles.manage'");}
  });
  test("unknown persisted role assignments fail closed instead of legacy fallback",async()=>{
    const legacy=await fixture([],true);const key="unknown_"+randomBytes(6).toString("hex");
    await pool.query("insert into admin_roles(key,description) values($1,'test unknown role')",[key]);
    try {
      await pool.query("insert into user_admin_roles(user_id,role_key) values($1,$2)",[legacy.id,key]);await flag(false);
      status(await request("/admin/users",legacy.token),403);
    } finally {await pool.query("delete from user_admin_roles where role_key=$1",[key]);await pool.query("delete from admin_roles where key=$1",[key]);}
  });
  test("administrators cannot grant a role whose permissions exceed their actual authority",async()=>{
    await pool.query("delete from admin_role_permissions where role_key='super_admin' and permission_key='wallets.manage'");
    try {status(await assign(superAdmin,ordinary,["super_admin"]),403);}
    finally {await pool.query("insert into admin_role_permissions(role_key,permission_key) values('super_admin','wallets.manage') on conflict do nothing");}
  });
  test("role events identify actor, target and changes and contain no authentication secrets",async()=>{
    status(await assign(superAdmin,ordinary,["viewer"]),200);status(await assign(superAdmin,ordinary,["operator"]),200);status(await assign(superAdmin,ordinary,[]),200);
    const events=(await pool.query("select actor_user_id,target_id,event_type,metadata from security_events where actor_user_id=$1",[superAdmin.id])).rows;
    for(const type of ["ADMIN_ROLE_ASSIGNED","ADMIN_ROLE_REMOVED","ADMIN_ROLES_UPDATED"])assert.ok(events.some(e=>e.event_type===type&&e.target_id===ordinary.id));
    const updates=events.filter(e=>e.event_type==="ADMIN_ROLES_UPDATED");assert.equal(updates.length,3);assert.deepEqual(updates[0].metadata.beforeRoles,[]);
    const serialized=JSON.stringify(events);for(const secret of secrets)assert.ok(!serialized.includes(secret),"Security events must not contain authentication secrets");
    const response=await request("/admin/users",superAdmin.token);status(response,200);assert.ok(!JSON.stringify(response.body).includes("passwordHash"));assert.ok(!JSON.stringify(response.body).includes("totpSecret"));
  });
  test("critical role audit failure rolls back assignments, authVersion and proof consumption",async()=>{
    const proof=await reauth(superAdmin,ordinary.id,["viewer"]);
    const suffix=randomBytes(6).toString("hex"); const name="rbac_test_audit_"+suffix;
    await pool.query(`create function ${name}() returns trigger language plpgsql as $$ begin if new.actor_user_id='${superAdmin.id}'::uuid and new.event_type::text='ADMIN_ROLES_UPDATED' then raise exception 'fixture audit failure'; end if; return new; end $$`);
    await pool.query(`create trigger ${name} before insert on security_events for each row execute function ${name}()`);
    try {
      status(await assign(superAdmin,ordinary,["viewer"],proof),500);
      const current=(await pool.query("select role,auth_version from users where id=$1",[ordinary.id])).rows[0];assert.equal(current.role,"USER");assert.equal(current.auth_version,0);
      assert.equal((await pool.query("select count(*)::int n from user_admin_roles where user_id=$1",[ordinary.id])).rows[0].n,0);
      assert.equal((await pool.query("select used_at from auth_reauth_tokens where token_hash=$1",[hashCredential(proof)])).rows[0].used_at,null);
      assert.equal((await pool.query("select count(*)::int n from security_events where actor_user_id=$1 and event_type='ADMIN_ROLE_ASSIGNED'",[superAdmin.id])).rows[0].n,0);
    } finally {await pool.query(`drop trigger ${name} on security_events`);await pool.query(`drop function ${name}()`);}
  });
  test("offline bootstrap requires explicit review, refuses ordinary accounts and audits recovery",async()=>{
    const run=promisify(execFile), script=fileURLToPath(new URL("../../dist/scripts/bootstrap-admin-roles.js",import.meta.url));
    const args=(id:string)=>[script,"--user-id",id,"--confirm-reviewed-admin","--reason","integration recovery verification"];
    await assert.rejects(run(process.execPath,args(viewer.id),{env:process.env}));
    await assert.rejects(run(process.execPath,[...args(ordinary.id),"--recover"],{env:process.env}));
    await run(process.execPath,[...args(viewer.id),"--recover"],{env:process.env});
    const roles=(await pool.query("select role_key from user_admin_roles where user_id=$1",[viewer.id])).rows.map(r=>r.role_key);assert.ok(roles.includes("super_admin"));
    status(await request("/admin/users",viewer.token),401);
    assert.equal((await pool.query("select count(*)::int n from security_events where actor_user_id=$1 and event_type='ADMIN_ROLES_BOOTSTRAPPED'",[viewer.id])).rows[0].n,1);
    assert.equal((await pool.query("select role from users where id=$1",[ordinary.id])).rows[0].role,"USER");
  });
  test("ordinary login, frozen-user read access and email-verification visibility remain compatible",async()=>{
    const login=await request("/auth/login",undefined,"POST",{identifier:ordinary.username,password});status(login,201);assert.equal(login.body.user.role,"USER");assert.equal(login.body.user.emailVerified,false);
    status(await request(`/admin/users/${ordinary.id}/status`,operator.token,"PATCH",{status:"FROZEN"}),200);status(await request("/auth/me",ordinary.token),200);
    const me=await request("/users/me",ordinary.token);status(me,200);assert.equal(me.body.user.status,"FROZEN");
  });
  test("configured fee principal rejects identity removal despite another active super-admin", async () => {
    const manager = await fixture(["super_admin"]);
    await withFeePrincipal(superAdmin, async () => {
      status(await request("/admin/fee-settings", manager.token), 200);
      status(await assign(manager, operator, ["viewer"]), 200);
      status(await request("/admin/fee-settings", manager.token), 200);
      const proof = await reauth(manager, superAdmin.id, []);
      const rejected = await assign(manager, superAdmin, [], proof);
      status(rejected, 409); assert.match(rejected.body.message, /configured fee principal/);
      assert.equal((await pool.query("select role,auth_version from users where id=$1", [superAdmin.id])).rows[0].role, "ADMIN");
      assert.equal((await pool.query("select auth_version from users where id=$1", [superAdmin.id])).rows[0].auth_version, 0);
      assert.equal((await pool.query("select used_at from auth_reauth_tokens where token_hash=$1", [hashCredential(proof)])).rows[0].used_at, null);
      assert.equal((await activeSupers()).length, 2);
      const fees = await request("/admin/fee-settings", manager.token); status(fees, 200); assert.equal(fees.body.feeWallet.userId, superAdmin.id);
    });
  });
  test("fee-principal suspension and ban revoke human access while retaining fee ownership", async () => {
    const manager = await fixture(["super_admin"]);
    await withFeePrincipal(superAdmin, async () => {
      for (const next of ["FROZEN", "BANNED", "ACTIVE"]) {
        status(await request(`/admin/users/${superAdmin.id}/status`, manager.token, "PATCH", { status: next }), 200);
        const fees = await request("/admin/fee-settings", manager.token); status(fees, 200); assert.equal(fees.body.feeWallet.userId, superAdmin.id);
        assert.equal((await pool.query("select role from users where id=$1", [superAdmin.id])).rows[0].role, "ADMIN");
      }
      status(await request("/admin", superAdmin.token), 401);
      status(await request(`/admin/users/${superAdmin.id}/status`, manager.token, "PATCH", { status: "ACTIVE", role: "USER" }), 400);
      status(await assign(manager, superAdmin, []), 409);
    });
  });
  test("concurrent fee-principal role removal and suspension preserve fee lookup", async () => {
    const manager = await fixture(["super_admin"]);
    await withFeePrincipal(superAdmin, async () => {
      const proof = await reauth(manager, superAdmin.id, []);
      const results = await race([() => assign(manager, superAdmin, [], proof), () => request(`/admin/users/${superAdmin.id}/status`, manager.token, "PATCH", { status: "BANNED" })]);
      assert.deepEqual(results.map(r => r.status).sort(), [200,409]);
      const fees = await request("/admin/fee-settings", manager.token); status(fees, 200); assert.equal(fees.body.feeWallet.userId, superAdmin.id);
    });
  });
  for (const header of ["x-forwarded-for", "x-real-ip"]) {
    test(`role mutation ignores forged ${header} while preserving actor/target audit attribution`, async () => {
      const proof = await reauth(superAdmin, ordinary.id, ["viewer"]);
      status(await request(`/admin/users/${ordinary.id}/roles`, superAdmin.token, "PUT", { roles: ["viewer"], reauthToken: proof }, { [header]: "203.0.113.51" }), 200);
      const row = (await pool.query("select actor_user_id,target_id,ip_address,metadata from security_events where actor_user_id=$1 and target_id=$2 and event_type='ADMIN_ROLES_UPDATED'", [superAdmin.id,ordinary.id])).rows[0];
      assert.equal(row.ip_address, "127.0.0.1"); assert.equal(row.actor_user_id, superAdmin.id); assert.equal(row.target_id, ordinary.id);
      assert.deepEqual(row.metadata.afterRoles, ["viewer"]);
    });
  }
  test("existing user-status audit consumer also ignores both forged forwarding headers", async () => {
    status(await request(`/admin/users/${ordinary.id}/status`, operator.token, "PATCH", { status: "FROZEN" }, { "x-forwarded-for": "203.0.113.51", "x-real-ip": "198.51.100.27" }), 200);
    const event = (await pool.query("select actor_user_id,target_id,ip_address from security_events where actor_user_id=$1 and target_id=$2 and event_type='USER_STATUS_CHANGED'", [operator.id,ordinary.id])).rows[0];
    assert.equal(event.actor_user_id, operator.id); assert.equal(event.target_id, ordinary.id); assert.equal(event.ip_address, "127.0.0.1");
  });
  test("shared audit context uses socket peer even when request.ip and both headers are forged", async () => {
    const { extractRequestSecurityContext } = await compiled("security/security-events.service");
    assert.equal(extractRequestSecurityContext({ headers: { "x-forwarded-for": "203.0.113.51", "x-real-ip": "198.51.100.27" }, ip: "192.0.2.1", socket: { remoteAddress: "127.0.0.1" } }).ipAddress, "127.0.0.1");
    assert.equal(extractRequestSecurityContext({ headers: { "x-forwarded-for": "203.0.113.51" }, ip: "192.0.2.1" }).ipAddress, null);
  });
  for (const [permission,resource] of [["audit.read","audit-logs"],["fees.read","fee-settings"],["wallets.read","wallets"],["trades.read","trades"],["transfers.read","transfers"]] as const) {
    test(`complete report denies viewer/operator without ${permission}`, async () => {
      for (const [role, actor] of [["viewer",viewer],["operator",operator]] as const) {
        await pool.query("delete from admin_role_permissions where role_key=$1 and permission_key=$2", [role,permission]);
        try {
          status(await request(`/admin/${resource}`, actor.token), 403);
          const report = await request("/admin/reports/summary", actor.token); status(report, 403);
          await flag(false); status(await request("/admin/reports/summary", actor.token), 403); await flag(true);
          for (const key of ["recentAuditLogs","feeWalletBalances","recentTrades","recentTransfers"]) assert.equal(report.body[key], undefined);
          status(await request("/admin", actor.token), 200);
        } finally { await pool.query("insert into admin_role_permissions(role_key,permission_key) values($1,$2) on conflict do nothing", [role,permission]); }
      }
    });
  }
  test("complete report retains its response for authorized viewer, operator and super-admin", async () => {
    for (const actor of [viewer,operator,superAdmin]) {
      const r = await request("/admin/reports/summary", actor.token); status(r, 200);
      for (const key of ["recentAuditLogs","feeWalletBalances","recentTrades","recentTransfers"]) assert.ok(Array.isArray(r.body[key]));
    }
    const { AdminController } = await compiled("admin/admin.controller");
    assert.deepEqual(Reflect.getMetadata("adminPermissionPolicy", AdminController.prototype.reportsSummary).permissions, [...ADMIN_REPORT_PERMISSIONS]);
  });
  test("legacy target ceiling uses effective authority with flag disabled and explicit authority when enabled", async () => {
    const legacy = await fixture([], true);
    await pool.query("delete from admin_role_permissions where role_key='super_admin' and permission_key='wallets.manage'");
    try {
      await flag(false); status(await assign(superAdmin, legacy, ["viewer"]), 403);
      assert.equal((await pool.query("select count(*)::int n from user_admin_roles where user_id=$1", [legacy.id])).rows[0].n, 0);
      await flag(true); status(await assign(superAdmin, legacy, ["viewer"]), 200);
    } finally { await pool.query("insert into admin_role_permissions(role_key,permission_key) values('super_admin','wallets.manage') on conflict do nothing"); }
  });
  test("full authority can manage legacy targets and removing all roles never creates broader fallback", async () => {
    const legacy = await fixture([], true); await flag(false);
    status(await assign(superAdmin, legacy, ["operator"]), 200);
    status(await assign(superAdmin, legacy, []), 200);
    const { AdminRolesService } = await compiled("admin-roles/admin-roles.service");
    const roles = app.get(AdminRolesService);
    assert.deepEqual((await roles.capabilities(legacy.id)).effectivePermissions, []);
    assert.deepEqual((await roles.capabilities(ordinary.id)).effectivePermissions, []);
    assert.equal((await pool.query("select role from users where id=$1", [legacy.id])).rows[0].role, "USER");
  });
  test("assigned target authority ceiling also prevents removal by a narrower role manager", async () => {
    await pool.query("delete from admin_role_permissions where role_key='super_admin' and permission_key='users.read'");
    try { status(await assign(superAdmin, viewer, []), 403); }
    finally { await pool.query("insert into admin_role_permissions(role_key,permission_key) values('super_admin','users.read') on conflict do nothing"); }
  });
  test("queued role change rechecks the target's newly increased authority inside the transaction", async () => {
    const fullManager = await fixture(["super_admin","operator"]);
    await pool.query("delete from admin_role_permissions where role_key='super_admin' and permission_key='assets.manage'");
    try {
      const changeProof = await reauth(fullManager, viewer.id, ["operator"]), staleProof = await reauth(superAdmin, viewer.id, []);
      const results = await queuedRace(() => assign(fullManager, viewer, ["operator"], changeProof), () => assign(superAdmin, viewer, [], staleProof));
      assert.deepEqual(results.map(r => r.status), [200,403]);
      assert.deepEqual((await pool.query("select role_key from user_admin_roles where user_id=$1", [viewer.id])).rows.map(r => r.role_key), ["operator"]);
      assert.equal((await pool.query("select used_at from auth_reauth_tokens where token_hash=$1", [hashCredential(staleProof)])).rows[0].used_at, null);
    } finally { await pool.query("insert into admin_role_permissions(role_key,permission_key) values('super_admin','assets.manage') on conflict do nothing"); }
  });
  test("semantic mutation matrix exercises valid payloads, revoked write scopes and persisted effects", async () => {
    const market = await isolatedMarket();
    status(await request("/admin/airdrop", superAdmin.token, "POST", { userId: superAdmin.id, assetSymbol: market.base, amount: "5" }), 201);
    const cases = [
      { permission: "users.manage", role: "operator", actor: operator, path: `/admin/users/${ordinary.id}/status`, method: "PATCH", body: { status: "FROZEN" }, success: 200 },
      { permission: "assets.manage", role: "operator", actor: operator, path: `/admin/assets/${market.base}/metadata`, method: "PATCH", body: { description: "Authorized semantic update" }, success: 200 },
      { permission: "markets.manage", role: "operator", actor: operator, path: `/admin/markets/${encodeURIComponent(market.symbol)}/status`, method: "PATCH", body: { status: "PAUSED" }, success: 200 },
      { permission: "fees.manage", role: "super_admin", actor: superAdmin, path: "/admin/fee-settings", method: "PATCH", body: { marketSymbol: market.symbol, buyerFeeRatePercent: "0.2", sellerFeeRatePercent: "0.3" }, success: 200 },
      { permission: "wallets.manage", role: "super_admin", actor: superAdmin, path: "/admin/wallet-buckets/transfer", method: "POST", body: { fromWalletType: "MAIN", toWalletType: "TREASURY", assetSymbol: market.base, amount: "1" }, success: 201 },
      { permission: "airdrops.execute", role: "super_admin", actor: superAdmin, path: "/admin/airdrop", method: "POST", body: { userId: ordinary.id, assetSymbol: market.base, amount: "1" }, success: 201 },
    ];
    for (const action of cases) {
      status(await request(action.path, viewer.token, action.method, action.body), 403);
      status(await request(action.path, ordinary.token, action.method, action.body), 403);
      if (action.role === "super_admin") status(await request(action.path, operator.token, action.method, action.body), 403);
      await pool.query("delete from admin_role_permissions where role_key=$1 and permission_key=$2", [action.role,action.permission]);
      try { status(await request(action.path, action.actor.token, action.method, action.body), 403); }
      finally { await pool.query("insert into admin_role_permissions(role_key,permission_key) values($1,$2) on conflict do nothing", [action.role,action.permission]); }
      status(await request(action.path, action.actor.token, action.method, action.body), action.success);
      if (action.permission === "users.manage") {
        assert.equal((await pool.query("select status from users where id=$1", [ordinary.id])).rows[0].status, "FROZEN");
        status(await request(action.path, operator.token, "PATCH", { status: "ACTIVE" }), 200);
      }
    }
    assert.equal((await pool.query("select description from assets where id=$1", [market.baseId])).rows[0].description, "Authorized semantic update");
    assert.equal((await pool.query("select status from markets where id=$1", [market.id])).rows[0].status, "PAUSED");
    assert.deepEqual((await pool.query("select buyer_fee_rate_bps,seller_fee_rate_bps from fee_settings where market_id=$1", [market.id])).rows[0], { buyer_fee_rate_bps:20,seller_fee_rate_bps:30 });
    assert.equal((await pool.query("select available_balance from wallets where user_id=$1 and asset_id=$2 and wallet_type='TREASURY'", [superAdmin.id,market.baseId])).rows[0].available_balance, "100");
    assert.equal((await pool.query("select available_balance from wallets where user_id=$1 and asset_id=$2 and wallet_type='MAIN'", [ordinary.id,market.baseId])).rows[0].available_balance, "100");
  });
  test("role reauthentication completes with 10 concurrent requests saturating 10 PostgreSQL connections", { timeout: 12_000 }, async () => {
      const size = 10;
      const priorMax = applicationPool.options.max;
      applicationPool.options.max = size;
      const secret = newTotpSecret(), recovery = newRecoveryCodes()[0]!;
      secrets.add(secret); secrets.add(recovery);
      await pool.query("update users set two_factor_enabled=true,totp_secret_encrypted=$2 where id=$1", [superAdmin.id, encryptTotp(secret, Buffer.from(process.env.TOTP_ENCRYPTION_KEY!, "hex"), superAdmin.id)]);
      await pool.query("insert into two_factor_recovery_codes(user_id,code_hash) values($1,$2)", [superAdmin.id, recoveryHash(superAdmin.id, recovery)]);
      superAdmin.token = await jwt.signAsync({ sub: superAdmin.id, authVersion: 0, amr: "mfa" });
      secrets.add(superAdmin.token);
      try {
        const replies = await saturatedUserRace(superAdmin.id, Array.from({ length: size }, () => () => request(`/admin/users/${ordinary.id}/roles/reauth`, superAdmin.token, "POST", { roles: ["viewer"], password, code: recovery })));
        assert.equal(applicationPool.totalCount, size, "Application pool must be deliberately bounded and fully occupied");
        assert.equal(replies.filter((r) => r.status === 201).length, 1);
        assert.equal(replies.filter((r) => r.status === 401).length, size - 1);
        for (const scope of ["2fa-reauth", "2fa-factor"]) assert.equal((await pool.query("select attempts from auth_rate_limits where key=$1", [hashCredential(scope + ":" + superAdmin.id)])).rows[0].attempts, size);
        const proof = replies.find((r) => r.status === 201)!.body.reauthToken; secrets.add(proof);
        const row = (await pool.query("select user_id,purpose,used_at,expires_at from auth_reauth_tokens where token_hash=$1", [hashCredential(proof)])).rows[0];
        assert.equal(row.user_id, superAdmin.id); assert.match(row.purpose, /^admin-roles:/); assert.equal(row.used_at, null);
        assert.ok(row.expires_at.getTime() > Date.now() && row.expires_at.getTime() <= Date.now() + 300_000);
        status(await assign(superAdmin, viewer, ["viewer"], proof), 401);
        status(await assign(superAdmin, ordinary, ["operator"], proof), 401);
        status(await assign(superAdmin, ordinary, ["viewer"], proof), 200);
        status(await assign(superAdmin, ordinary, ["viewer"], proof), 401);
        assert.ok((await pool.query("select used_at from auth_reauth_tokens where token_hash=$1", [hashCredential(proof)])).rows[0].used_at);
        const events = (await pool.query("select event_type,metadata from security_events where actor_user_id=$1", [superAdmin.id])).rows;
        assert.equal(events.filter((e) => e.event_type === "TWO_FACTOR_RECOVERY_USED").length, 1);
        assert.equal(events.filter((e) => e.event_type === "SENSITIVE_ACTION_CONFIRMED").length, 1);
        assert.ok(events.some((e) => e.event_type === "ADMIN_ACCESS_DENIED"));
        const serialized = JSON.stringify(events); for (const value of secrets) assert.ok(!serialized.includes(value), "Contention events must redact credentials");
        // Failed factor transactions did not roll back either limiter.
        status(await request(`/admin/users/${viewer.id}/roles/reauth`, superAdmin.token, "POST", { roles: ["viewer"], password, code: recovery }), 429);
        assert.equal((await pool.query("select attempts from auth_rate_limits where key=$1", [hashCredential("2fa-reauth:" + superAdmin.id)])).rows[0].attempts, 11);
        assert.equal((await pool.query("select attempts from auth_rate_limits where key=$1", [hashCredential("2fa-factor:" + superAdmin.id)])).rows[0].attempts, 10);
      } finally { applicationPool.options.max = priorMax; }
  });
  test("concurrent role reauthentication preserves the shared factor budget at its boundary", async () => {
    const recovery = newRecoveryCodes()[0]!; secrets.add(recovery);
    await pool.query("update users set two_factor_enabled=true where id=$1", [superAdmin.id]);
    await pool.query("insert into two_factor_recovery_codes(user_id,code_hash) values($1,$2)", [superAdmin.id, recoveryHash(superAdmin.id, recovery)]);
    superAdmin.token = await jwt.signAsync({ sub: superAdmin.id, authVersion: 0, amr: "mfa" });
    const key = hashCredential("2fa-factor:" + superAdmin.id);
    await pool.query("insert into auth_rate_limits(key,window_start,attempts) values($1,$2,29)", [key, new Date(Math.floor(Date.now() / 300_000) * 300_000)]);
    const replies = await Promise.all(Array.from({ length: 10 }, () => request(`/admin/users/${ordinary.id}/roles/reauth`, superAdmin.token, "POST", { roles: ["viewer"], password, code: recovery })));
    assert.equal(replies.filter((r) => r.status === 201).length, 1);
    assert.equal(replies.filter((r) => r.status === 429).length, 9);
    assert.equal((await pool.query("select attempts from auth_rate_limits where key=$1", [key])).rows[0].attempts, 39);
    assert.equal((await pool.query("select attempts from auth_rate_limits where key=$1", [hashCredential("2fa-reauth:" + superAdmin.id)])).rows[0].attempts, 10);
  });
  for (const permission of ["fees.read", "wallets.read"] as const) {
    test(`complete fee settings deny every shipped role without ${permission} before querying balances`, async () => {
      for (const [role, actor] of [["viewer", viewer], ["operator", operator], ["super_admin", superAdmin]] as const) {
        await pool.query("delete from admin_role_permissions where role_key=$1 and permission_key=$2", [role, permission]);
        try {
          for (const enabled of [false, true]) {
            await flag(enabled);
            // An invalid market would return 404 if the protected handler ran.
            for (const path of ["/admin/fee-settings", "/admin/fee-settings?marketSymbol=MISSING/PRIVATE", "/admin/reports/summary"]) {
              const denied = await request(path, actor.token); status(denied, 403);
              assert.ok(!JSON.stringify(denied.body).includes("availableRaw")); assert.equal(denied.body.feeWallet, undefined);
            }
            for (const method of ["PATCH", "POST"]) status(await request("/admin/fee-settings", actor.token, method, { buyerFeeRatePercent: "0.1", sellerFeeRatePercent: "0.1" }), 403);
            if (permission === "wallets.read") for (const path of ["/admin/wallets", "/admin/wallet", "/admin/system-wallets"]) status(await request(path, actor.token), 403);
            else status(await request("/admin/wallets", actor.token), 200);
          }
        } finally { await pool.query("insert into admin_role_permissions(role_key,permission_key) values($1,$2) on conflict do nothing", [role, permission]); }
      }
    });
  }
  test("fully authorized fee settings preserve balances and both management aliases", async () => {
    for (const enabled of [false, true]) {
      await flag(enabled);
      for (const actor of [viewer, operator, superAdmin]) {
        const r = await request("/admin/fee-settings", actor.token); status(r, 200);
        assert.ok(r.body.feeWallet.balances.length > 0);
        for (const balance of r.body.feeWallet.balances) { assert.equal(typeof balance.availableRaw, "string"); assert.equal(typeof balance.lockedRaw, "string"); }
      }
    }
    const market = await isolatedMarket();
    for (const method of ["PATCH", "POST"]) {
      const r = await request("/admin/fee-settings", superAdmin.token, method, { marketSymbol: market.symbol, buyerFeeRatePercent: "0.2", sellerFeeRatePercent: "0.3" });
      status(r, method === "POST" ? 201 : 200); assert.ok(Array.isArray(r.body.feeWallet.balances));
      assert.equal(r.body.buyerFeeRateBps, 20); assert.equal(r.body.sellerFeeRateBps, 30);
    }
  });
  for (const enabled of [false, true]) {
    test(`status mutations reject stronger assigned administrators with enforcement ${enabled}`, async () => {
      const stronger = await fixture(["super_admin", "operator"]);
      await flag(enabled);
      await pool.query("delete from admin_role_permissions where role_key='super_admin' and permission_key='assets.manage'");
      try {
        status(await assign(superAdmin, stronger, []), 403);
        for (const prior of ["ACTIVE", "FROZEN", "BANNED"]) {
          await pool.query("update users set status=$2 where id=$1", [stronger.id, prior]);
          for (const next of ["FROZEN", "BANNED", "ACTIVE"]) {
            const r = await request(`/admin/users/${stronger.id}/status`, superAdmin.token, "PATCH", { status: next });
            status(r, 403); assert.equal(r.body.message, "Cannot manage authority above your own.");
            assert.deepEqual((await pool.query("select status,auth_version from users where id=$1", [stronger.id])).rows[0], { status: prior, auth_version: 0 });
          }
        }
        // Narrow authority still legitimately manages ordinary accounts.
        for (const next of ["FROZEN", "BANNED", "ACTIVE"]) status(await request(`/admin/users/${ordinary.id}/status`, superAdmin.token, "PATCH", { status: next }), 200);
        assert.equal((await pool.query("select count(*)::int n from security_events where actor_user_id=$1 and target_id=$2 and event_type='USER_STATUS_CHANGED'", [superAdmin.id, stronger.id])).rows[0].n, 0);
      } finally { await pool.query("insert into admin_role_permissions(role_key,permission_key) values('super_admin','assets.manage') on conflict do nothing"); }
      // Full authority still performs suspension/reactivation and revokes sessions.
      const manager = await fixture(["super_admin"]);
      let version = 0;
      for (const next of ["FROZEN", "ACTIVE"]) {
        status(await request(`/admin/users/${stronger.id}/status`, manager.token, "PATCH", { status: next }), 200);
        assert.equal((await pool.query("select auth_version from users where id=$1", [stronger.id])).rows[0].auth_version, ++version);
        status(await request("/auth/me", stronger.token), 401);
      }
      const login = await request("/auth/login", undefined, "POST", { identifier: stronger.username, password }); status(login, 201);
      status(await request("/admin", login.body.accessToken), 200);
    });
    test(`legacy administrator status uses effective target authority with enforcement ${enabled}`, async () => {
      const legacy = await fixture([], true); await flag(enabled);
      await pool.query("delete from admin_role_permissions where role_key='super_admin' and permission_key='assets.manage'");
      try {
        for (const next of ["FROZEN", "ACTIVE"]) {
          if (!enabled) await pool.query("update users set status=$2 where id=$1", [legacy.id, next === "ACTIVE" ? "FROZEN" : "ACTIVE"]);
          const r = await request(`/admin/users/${legacy.id}/status`, superAdmin.token, "PATCH", { status: next });
          status(r, enabled ? 200 : 403);
          if (!enabled) assert.equal(r.body.message, "Cannot manage authority above your own.");
        }
        assert.equal((await pool.query("select auth_version from users where id=$1", [legacy.id])).rows[0].auth_version, enabled ? 2 : 0);
        if (!enabled) {
          const fullManager = await fixture(["super_admin", "operator"]);
          status(await request(`/admin/users/${legacy.id}/status`, fullManager.token, "PATCH", { status: "ACTIVE" }), 200);
        }
      } finally { await pool.query("insert into admin_role_permissions(role_key,permission_key) values('super_admin','assets.manage') on conflict do nothing"); }
    });
    for (const next of ["FROZEN", "ACTIVE"]) {
      test(`queued ${next} rechecks increased target authority with enforcement ${enabled}`, async () => {
        const fullManager = await fixture(["super_admin", "operator"]); await flag(enabled);
        if (next === "ACTIVE") await pool.query("update users set status='FROZEN' where id=$1", [viewer.id]);
        await pool.query("delete from admin_role_permissions where role_key='super_admin' and permission_key='assets.manage'");
        try {
          const proof = await reauth(fullManager, viewer.id, ["operator"]);
          const results = await queuedRace(() => assign(fullManager, viewer, ["operator"], proof), () => request(`/admin/users/${viewer.id}/status`, superAdmin.token, "PATCH", { status: next }));
          assert.deepEqual(results.map((r) => r.status), [200, 403]);
          assert.equal(results[1]!.body.message, "Cannot manage authority above your own.");
          assert.deepEqual((await pool.query("select status,auth_version from users where id=$1", [viewer.id])).rows[0], { status: next === "ACTIVE" ? "FROZEN" : "ACTIVE", auth_version: 1 });
        } finally { await pool.query("insert into admin_role_permissions(role_key,permission_key) values('super_admin','assets.manage') on conflict do nothing"); }
      });
    }
    test(`queued status rechecks an ordinary target promoted to stronger administrator with enforcement ${enabled}`, async () => {
      const fullManager = await fixture(["super_admin", "operator"]); await flag(enabled);
      await pool.query("delete from admin_role_permissions where role_key='super_admin' and permission_key='assets.manage'");
      try {
        const proof = await reauth(fullManager, ordinary.id, ["operator"]);
        const results = await queuedRace(() => assign(fullManager, ordinary, ["operator"], proof), () => request(`/admin/users/${ordinary.id}/status`, superAdmin.token, "PATCH", { status: "FROZEN" }));
        assert.deepEqual(results.map((r) => r.status), [200, 403]);
        assert.deepEqual((await pool.query("select role,status,auth_version from users where id=$1", [ordinary.id])).rows[0], { role: "ADMIN", status: "ACTIVE", auth_version: 1 });
      } finally { await pool.query("insert into admin_role_permissions(role_key,permission_key) values('super_admin','assets.manage') on conflict do nothing"); }
    });
  }
  for (const orderType of ["LIMIT","MARKET"] as const) {
    test(`${orderType} fills settle exact fees to the protected principal after unrelated demotion and principal suspension`, async () => {
      const manager = await fixture(["super_admin"]), buyer = await fixture(), seller = await fixture(), market = await isolatedMarket();
      await withFeePrincipal(superAdmin, async () => {
        status(await request("/admin/airdrop", manager.token, "POST", { userId: buyer.id, assetSymbol: market.quote, amount: "1000" }), 201);
        status(await request("/admin/airdrop", manager.token, "POST", { userId: seller.id, assetSymbol: market.base, amount: "100" }), 201);
        status(await assign(manager, operator, ["viewer"]), 200);
        status(await assign(manager, superAdmin, []), 409);
        status(await request(`/admin/users/${superAdmin.id}/status`, manager.token, "PATCH", { status:"FROZEN" }), 200);
        const fees = await request(`/admin/fee-settings?marketSymbol=${encodeURIComponent(market.symbol)}`, manager.token); status(fees, 200);
        assert.equal(fees.body.feeWallet.userId, superAdmin.id); assert.equal(fees.body.buyerFeeRateBps, 10); assert.equal(fees.body.sellerFeeRateBps, 10);
        status(await request("/orders", seller.token, "POST", { marketSymbol: market.symbol, side:"SELL", type:"LIMIT", price:"10", amount:"10" }), 201);
        const buy = orderType === "LIMIT" ? { marketSymbol:market.symbol,side:"BUY",type:"LIMIT",price:"10",amount:"10" } : { marketSymbol:market.symbol,side:"BUY",type:"MARKET",quoteAmount:"100" };
        status(await request("/orders", buyer.token, "POST", buy), 201);
        const fills = (await pool.query("select t.*,o.type as buy_type from trades t join orders o on o.id=t.buy_order_id where t.market_id=$1", [market.id])).rows;
        assert.equal(fills.length, 1); const fill = fills[0]; assert.equal(fill.status,"SETTLED"); assert.equal(fill.buy_type,orderType);
        assert.equal(fill.buyer_fee,"1"); assert.equal(fill.seller_fee,"10"); assert.equal(fill.buyer_fee_rate_bps,10); assert.equal(fill.seller_fee_rate_bps,10);
        for (const [who,asset,type,amount] of [[buyer.id,market.baseId,"MAIN","999"],[buyer.id,market.quoteId,"MAIN","90000"],[seller.id,market.baseId,"MAIN","9000"],[seller.id,market.quoteId,"MAIN","9990"],[superAdmin.id,market.baseId,"FEE","1"],[superAdmin.id,market.quoteId,"FEE","10"]]) {
          const wallet = (await pool.query("select available_balance,locked_balance from wallets where user_id=$1 and asset_id=$2 and wallet_type=$3", [who,asset,type])).rows[0];
          assert.equal(wallet.available_balance,amount); assert.equal(wallet.locked_balance,"0");
        }
      });
    });
  }

});
