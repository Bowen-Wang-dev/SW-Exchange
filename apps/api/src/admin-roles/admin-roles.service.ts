import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ADMIN_PERMISSIONS, ADMIN_ROLE_DEFINITIONS, ADMIN_ROLE_KEYS, type AdminPermission, type AdminRoleKey, type SecurityEventType } from "@sw-exchange/shared";
import { ConfigService } from "@nestjs/config";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { DRIZZLE_DB, type Database } from "../db/database.module.js";
import { adminRolePermissions, userAdminRoles, users, authReauthTokens, twoFactorLoginChallenges } from "../db/schema/index.js";
import { SecurityEventsService } from "../security/security-events.service.js";
import { TwoFactorService, type ReauthPurpose } from "../auth/two-factor.service.js";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Context = { ipAddress?: string | null; userAgent?: string | null };
// Shared by role writes, admin status changes, and the offline bootstrap command.
export const ADMIN_SECURITY_LOCK = 1040004;

@Injectable()
export class AdminRolesService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(SecurityEventsService) private readonly events: SecurityEventsService,
    @Inject(TwoFactorService) private readonly twoFactor: TwoFactorService,
    @Inject(FeatureFlagsService) private readonly flags: FeatureFlagsService,
  ) {}

  async access(userId: string, db: Database | Tx = this.db) {
    const roles = await db.select({ key: userAdminRoles.roleKey }).from(userAdminRoles).where(eq(userAdminRoles.userId, userId));
    const roleKeys = roles.map((r) => r.key).filter((key): key is AdminRoleKey => ADMIN_ROLE_KEYS.includes(key as AdminRoleKey));
    const rows = roleKeys.length ? await db.select({ key: adminRolePermissions.permissionKey }).from(adminRolePermissions).where(inArray(adminRolePermissions.roleKey, roleKeys)) : [];
    // Both the deployed registry and DB mapping must allow a permission. No wildcard or unreviewed DB-only grant.
    const allowed = new Set(ADMIN_ROLE_DEFINITIONS.filter((r) => roleKeys.includes(r.key)).flatMap((r) => [...r.permissions]));
    return { hasAssignments: roles.length > 0, roles: roleKeys.sort(), permissions: [...new Set(rows.map((r) => r.key).filter((key): key is AdminPermission => allowed.has(key as AdminPermission)))].sort() };
  }

  async capabilities(
    userId: string,
    db: Database | Tx = this.db,
    identity?: Pick<typeof users.$inferSelect, "role" | "isSystem">,
  ) {
    const access = await this.access(userId, db);
    const user = identity ?? (await db.select({ role: users.role, isSystem: users.isSystem }).from(users).where(eq(users.id, userId)))[0];
    const enforcementEnabled = await this.flags.isFeatureEnabled("enableAdminRolePermissions", db);
    // Legacy compatibility is an ADMIN identity policy, never an ordinary-user fallback.
    const effectivePermissions = !user || user.role !== "ADMIN" || user.isSystem ? []
      : enforcementEnabled || access.hasAssignments ? access.permissions
      : ADMIN_PERMISSIONS.filter((p) => p !== "admin_roles.manage");
    return { ...access, enforcementEnabled, effectivePermissions };
  }

  private assertFeePrincipalIdentity(target: typeof users.$inferSelect, nextRole: "ADMIN" | "USER") {
    // FeesService resolves this exact email + ADMIN + non-system identity. Status is
    // deliberately independent: suspending a compromised human must remain possible.
    if (target.email === this.config.getOrThrow<string>("ADMIN_EMAIL") && nextRole !== "ADMIN") {
      throw new ConflictException("Cannot remove the configured fee principal's ADMIN identity. Fee-principal separation requires a reviewed maintenance procedure.");
    }
  }

  async listRoles() {
    // Return actual deployed grants, bounded by the versioned registry.
    const rows = await this.db.select().from(adminRolePermissions);
    return ADMIN_ROLE_DEFINITIONS.map((r) => ({ ...r, permissions: r.permissions.filter((p) => rows.some((row) => row.roleKey === r.key && row.permissionKey === p)) }));
  }

  async userRoles(id: string) {
    const [user] = await this.db.select({ id: users.id, username: users.username, role: users.role, status: users.status, isSystem: users.isSystem }).from(users).where(eq(users.id, id));
    if (!user || user.isSystem) throw new NotFoundException("User not found.");
    return { user, ...await this.access(id) };
  }

  private normalize(roles: string[]) {
    if (!Array.isArray(roles) || roles.length > ADMIN_ROLE_KEYS.length || roles.some((r) => !ADMIN_ROLE_KEYS.includes(r as AdminRoleKey)) || new Set(roles).size !== roles.length) throw new BadRequestException("Unknown or duplicate administrator role.");
    return [...roles].sort() as AdminRoleKey[];
  }

  private purpose(id: string, roles: string[]): ReauthPurpose {
    return `admin-roles:${createHash("sha256").update(`${id}:${roles.join(",")}`).digest("base64url")}`;
  }

  async reauthenticate(actorId: string, version: number, targetId: string, roles: string[], password: string, code: string | undefined, context: Context) {
    const normalized = this.normalize(roles);
    try {
      const [actor] = await this.db.select().from(users).where(eq(users.id, actorId));
      if (!actor || actor.isSystem || actor.role !== "ADMIN" || actor.status !== "ACTIVE" || !(await this.access(actorId)).permissions.includes("admin_roles.manage")) throw new ForbiddenException("Administrator role management permission required.");
      const proof = await this.twoFactor.reauthenticate(actorId, version, password, this.purpose(targetId, normalized), code, context);
      await this.events.recordEvent({ actorUserId: actorId, actorRole: "ADMIN", eventType: "SENSITIVE_ACTION_CONFIRMED", severity: "WARNING", targetType: "USER", targetId, ...context, metadata: { operation: "ADMIN_ROLES_REAUTH", roles: normalized } });
      return proof;
    } catch (error) {
      await this.denied(actorId, targetId, "ADMIN_ACCESS_DENIED", "ROLE_REAUTH_REJECTED", context, "ADMIN_ROLES_REAUTH");
      throw error;
    }
  }

  async setRoles(actorId: string, version: number, targetId: string, roles: string[], reauthToken: string, context: Context) {
    const normalized = this.normalize(roles);
    try {
      return await this.db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_SECURITY_LOCK})`);
        const people = await tx.select().from(users).where(inArray(users.id, [...new Set([actorId, targetId])])).orderBy(users.id).for("update");
        const actor = people.find((u) => u.id === actorId), target = people.find((u) => u.id === targetId);
        if (!actor || actor.authVersion !== version) throw new UnauthorizedException("Invalid session.");
        const authority = await this.access(actorId, tx);
        if (actor.isSystem || actor.role !== "ADMIN" || actor.status !== "ACTIVE" || !authority.permissions.includes("admin_roles.manage")) throw new ForbiddenException("Administrator role management permission required.");
        if (!target || target.isSystem) throw new NotFoundException("User not found.");
        const before = await this.access(targetId, tx);
        const targetAuthority = await this.capabilities(targetId, tx, target);
        const grants = ADMIN_ROLE_DEFINITIONS.filter((r) => normalized.includes(r.key)).flatMap((r) => [...r.permissions]);
        if (grants.some((p) => !authority.permissions.includes(p)) || before.permissions.some((p) => !authority.permissions.includes(p)) || targetAuthority.effectivePermissions.some((p) => !authority.permissions.includes(p))) throw new ForbiddenException("Cannot manage authority above your own.");
        if (before.roles.includes("super_admin") && !normalized.includes("super_admin") && target.status === "ACTIVE") await this.assertAnotherSuper(tx, targetId);
        if (actorId === targetId && normalized.join(",") !== before.roles.join(",")) throw new ForbiddenException("Cannot change your own administrator roles.");
        this.assertFeePrincipalIdentity(target, normalized.length ? "ADMIN" : "USER");
        await this.twoFactor.consumeReauth(tx, actorId, reauthToken, this.purpose(targetId, normalized));
        if (normalized.join(",") === before.roles.join(",") && target.role === (normalized.length ? "ADMIN" : "USER")) return { userId: targetId, ...before, changed: false };
        await tx.delete(userAdminRoles).where(eq(userAdminRoles.userId, targetId));
        if (normalized.length) await tx.insert(userAdminRoles).values(normalized.map((roleKey) => ({ userId: targetId, roleKey, assignedBy: actorId })));
        await tx.update(users).set({ role: normalized.length ? "ADMIN" : "USER", authVersion: target.authVersion + 1, updatedAt: new Date() }).where(eq(users.id, targetId));
        await tx.delete(authReauthTokens).where(eq(authReauthTokens.userId, targetId));
        await tx.delete(twoFactorLoginChallenges).where(eq(twoFactorLoginChallenges.userId, targetId));
        const metadata = { operation: "REPLACE_ADMIN_ROLES", beforeRoles: before.roles, afterRoles: normalized, beforeBaseRole: target.role, afterBaseRole: normalized.length ? "ADMIN" : "USER" };
        for (const role of normalized.filter((r) => !before.roles.includes(r))) await this.events.recordEvent({ actorUserId: actorId, actorRole: "ADMIN", eventType: "ADMIN_ROLE_ASSIGNED", severity: "CRITICAL", targetType: "USER", targetId, ...context, metadata: { ...metadata, role } }, { swallowErrors: false, transaction: tx });
        for (const role of before.roles.filter((r) => !normalized.includes(r))) await this.events.recordEvent({ actorUserId: actorId, actorRole: "ADMIN", eventType: "ADMIN_ROLE_REMOVED", severity: "CRITICAL", targetType: "USER", targetId, ...context, metadata: { ...metadata, role } }, { swallowErrors: false, transaction: tx });
        await this.events.recordEvent({ actorUserId: actorId, actorRole: "ADMIN", eventType: "ADMIN_ROLES_UPDATED", severity: "CRITICAL", targetType: "USER", targetId, ...context, metadata }, { swallowErrors: false, transaction: tx });
        return { userId: targetId, ...await this.access(targetId, tx), changed: true };
      });
    } catch (error) {
      const last = error instanceof ForbiddenException && error.message.includes("last active super-admin");
      await this.denied(actorId, targetId, last ? "ADMIN_LAST_SUPER_ADMIN_PROTECTED" : "ADMIN_PRIVILEGE_ESCALATION_REJECTED", error instanceof ForbiddenException || error instanceof UnauthorizedException || error instanceof ConflictException ? error.message : "ROLE_UPDATE_REJECTED", context);
      throw error;
    }
  }

  async assertAnotherSuper(tx: Tx, targetId: string) {
    const rows = await tx.select({ id: users.id }).from(users).innerJoin(userAdminRoles, eq(users.id, userAdminRoles.userId)).where(and(eq(userAdminRoles.roleKey, "super_admin"), eq(users.role, "ADMIN"), eq(users.status, "ACTIVE"), eq(users.isSystem, false)));
    if (!rows.some((u) => u.id !== targetId)) throw new ForbiddenException("Cannot remove or suspend the last active super-admin.");
  }

  async authorizeUserStatus(tx: Tx, actorId: string, version?: number) {
    const [actor] = await tx.select().from(users).where(eq(users.id, actorId));
    if (!actor || actor.role !== "ADMIN" || actor.status !== "ACTIVE" || actor.isSystem || (version !== undefined && actor.authVersion !== version)) throw new UnauthorizedException("Invalid session.");
    const authority = await this.capabilities(actorId, tx, actor);
    if (!authority.effectivePermissions.includes("users.manage")) throw new ForbiddenException("User management permission required.");
  }

  async authorizeAdminStatus(tx: Tx, actorId: string, targetId: string, nextStatus: string, version?: number) {
    const [actor] = await tx.select().from(users).where(eq(users.id, actorId));
    if (!actor || actor.role !== "ADMIN" || actor.status !== "ACTIVE" || actor.isSystem || (version !== undefined && actor.authVersion !== version)) throw new UnauthorizedException("Invalid session.");
    const access = await this.capabilities(actorId, tx, actor);
    if (!access.permissions.includes("admin_roles.manage")) throw new ForbiddenException("Administrator status changes require administrator role management permission.");
    // The caller holds the shared administrative lock and target row lock.
    // Resolve the same live, legacy-aware authority used by role replacement
    // before either suspension or reactivation, including no-op requests.
    const target = await this.capabilities(targetId, tx);
    if ([...target.permissions, ...target.effectivePermissions].some((p) => !access.effectivePermissions.includes(p))) throw new ForbiddenException("Cannot manage authority above your own.");
    if (nextStatus !== "ACTIVE" && target.roles.includes("super_admin")) await this.assertAnotherSuper(tx, targetId);
  }

  denied(actorId: string | null, targetId: string | null, eventType: SecurityEventType, reason: string, context: Context, operation = "ADMIN_ROLE_CHANGE") {
    return this.events.recordEvent({ actorUserId: actorId, eventType, severity: "WARNING", targetType: targetId ? "USER" : "ADMIN_ROUTE", targetId, ...context, metadata: { reason, operation } });
  }
}
