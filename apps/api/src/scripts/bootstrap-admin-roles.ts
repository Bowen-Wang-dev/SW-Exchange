import "dotenv/config";
import { Pool } from "pg";
const args = process.argv.slice(2);
const id = args[args.indexOf("--user-id") + 1];
const reason = args[args.indexOf("--reason") + 1];
if (!args.includes("--confirm-reviewed-admin") || !args.includes("--user-id") || !/^[0-9a-f-]{36}$/i.test(id ?? "") || !args.includes("--reason") || !reason?.trim() || reason.length > 250) {
  throw new Error("Usage: admin:bootstrap --user-id <UUID> --confirm-reviewed-admin --reason <review reference> [--recover]. Target must already be an ACTIVE non-system ADMIN. No account is silently promoted.");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("begin");
  await client.query("select pg_advisory_xact_lock(1040004)");
  const user = (await client.query("select id,role,status,is_system from users where id=$1 for update", [id])).rows[0];
  if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE" || user.is_system) throw new Error("Target must be a reviewed existing ACTIVE non-system ADMIN.");
  const existing = (await client.query("select u.id from users u join user_admin_roles r on r.user_id=u.id where u.role='ADMIN' and u.status='ACTIVE' and u.is_system=false and r.role_key='super_admin'")).rows;
  if (existing.length && !args.includes("--recover")) throw new Error("An active super-admin exists. Use the authenticated role API, or explicitly supply --recover for an audited offline recovery.");
  const changed = await client.query("insert into user_admin_roles(user_id,role_key) values($1,'super_admin') on conflict do nothing returning user_id", [id]);
  if (changed.rowCount) {
    await client.query("update users set auth_version=auth_version+1,updated_at=now() where id=$1", [id]);
    await client.query("delete from auth_reauth_tokens where user_id=$1", [id]);
    await client.query("delete from two_factor_login_challenges where user_id=$1", [id]);
    await client.query("insert into security_events(actor_user_id,actor_role,event_type,severity,target_type,target_id,metadata) values($1,'ADMIN','ADMIN_ROLES_BOOTSTRAPPED','CRITICAL','USER',$1,$2::jsonb)", [id, JSON.stringify({ operation: "OFFLINE_REVIEWED_BOOTSTRAP", role: "super_admin", reason, recovery: args.includes("--recover"), actor: "trusted database operator" })]);
  }
  await client.query("commit");
  console.log(changed.rowCount ? "Reviewed admin bootstrap completed; prior target sessions revoked." : "Reviewed administrator already has super_admin; no change.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally { client.release(); await pool.end(); }
