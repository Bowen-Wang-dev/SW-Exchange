import { BadRequestException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { compare } from "bcryptjs";
import QRCode from "qrcode";
import { type SecurityEventType } from "@sw-exchange/shared";
import { DRIZZLE_DB, type Database } from "../db/database.module.js";
import { users, twoFactorLoginChallenges as challenges, twoFactorRecoveryCodes as codes, authReauthTokens } from "../db/schema/index.js";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service.js";
import { SecurityEventsService } from "../security/security-events.service.js";
import { AuthRateLimitService } from "./auth-rate-limit.service.js";
import { decryptTotp, encryptTotp, hashCredential, newRecoveryCodes, newTotpSecret, provisioningUri, readTwoFactorKey, recoveryHash, verifyTotp } from "./two-factor.crypto.js";

type User = typeof users.$inferSelect;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Context = { ipAddress?: string | null; userAgent?: string | null };
export type ReauthPurpose = "2fa-setup" | "2fa-enable" | "2fa-disable" | "2fa-recovery-regenerate" | `admin-roles:${string}`;

@Injectable()
export class TwoFactorService {
  private readonly key: Buffer | null;
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(ConfigService) config: ConfigService,
    @Inject(FeatureFlagsService) private readonly flags: FeatureFlagsService,
    @Inject(SecurityEventsService) private readonly events: SecurityEventsService,
    @Inject(AuthRateLimitService) private readonly limits: AuthRateLimitService,
  ) {
    this.key = readTwoFactorKey(config.get<string>("TOTP_ENCRYPTION_KEY"));
    if (!this.key && config.get<string>("NODE_ENV") === "production") throw new Error("TOTP_ENCRYPTION_KEY is required in production.");
  }

  private requireKey() {
    if (!this.key) throw new ServiceUnavailableException("Two-factor encryption is not configured.");
    return this.key;
  }

  private async lockedUser(tx: Tx, id: string, version?: number) {
    const [user] = await tx.select().from(users).where(eq(users.id, id)).for("update");
    if (!user || user.isSystem || user.status === "BANNED" || (version !== undefined && user.authVersion !== version)) {
      throw new UnauthorizedException("Invalid session.");
    }
    return user;
  }

  async reauthenticate(userId: string, version: number, password: string, purpose: ReauthPurpose, code?: string, context: Context = {}) {
    await this.limits.check("2fa-reauth", userId, 10, 300);
    // Complete durable accounting before taking the user lock. A nested pooled
    // query here can deadlock a full pool of requests waiting on that same user.
    // Reserve the factor budget for role proofs even when no factor is enrolled;
    // enrollment and session freshness are still checked under the user lock.
    if (purpose.startsWith("admin-roles:")) await this.limits.check("2fa-factor", userId, 30, 300);
    let recoveryUser: User | undefined;
    const result = await this.db.transaction(async (tx) => {
      const user = await this.lockedUser(tx, userId, version);
      if (!(await compare(password, user.passwordHash))) throw new UnauthorizedException("Invalid credentials.");
      if (purpose.startsWith("admin-roles:") && user.twoFactorEnabled) {
        const factor = code ? await this.consumeFactor(tx, user, code) : null;
        if (!factor) throw new UnauthorizedException("A fresh second factor is required.");
        if (factor === "RECOVERY") recoveryUser = user;
      }
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 5 * 60_000);
      await tx.delete(authReauthTokens).where(and(eq(authReauthTokens.userId, userId), eq(authReauthTokens.purpose, purpose)));
      await tx.insert(authReauthTokens).values({ userId, tokenHash: hashCredential(token), purpose, expiresAt });
      return { reauthToken: token, expiresAt };
    });
    if (recoveryUser) await this.event(recoveryUser, "TWO_FACTOR_RECOVERY_USED", context);
    return result;
  }

  async consumeReauth(tx: Tx, userId: string, token: string, purpose: ReauthPurpose) {
    const [reauth] = await tx.select().from(authReauthTokens).where(eq(authReauthTokens.tokenHash, hashCredential(token))).for("update");
    if (!reauth || reauth.userId !== userId || reauth.purpose !== purpose || reauth.usedAt || reauth.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Invalid or expired reauthentication.");
    }
    await tx.update(authReauthTokens).set({ usedAt: new Date() }).where(eq(authReauthTokens.id, reauth.id));
  }

  async passwordLogin(userId: string, context: Context) {
    const result = await this.db.transaction(async (tx) => {
      const user = await this.lockedUser(tx, userId);
      if (!user.twoFactorEnabled) return { user };
      this.requireKey();
      const challengeToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 5 * 60_000);
      // Only the latest password-verified attempt remains live.
      await tx.delete(challenges).where(eq(challenges.userId, user.id));
      await tx.insert(challenges).values({ userId: user.id, tokenHash: hashCredential(challengeToken), authVersion: user.authVersion, expiresAt });
      return { user, challengeToken, expiresAt };
    });
    if (result.challengeToken) await this.event(result.user, "TWO_FACTOR_LOGIN_REQUIRED", context);
    return result;
  }

  async setup(userId: string, version: number, reauthToken: string, context: Context) {
    await this.limits.check("2fa-setup", userId, 10, 600);
    try {
      const key = this.requireKey();
      const result = await this.db.transaction(async (tx) => {
        const user = await this.lockedUser(tx, userId, version);
        await this.flags.assertFeatureEnabled("enable2FA", tx);
        await this.consumeReauth(tx, userId, reauthToken, "2fa-setup");
        if (user.twoFactorEnabled) throw new BadRequestException("Two-factor authentication is already enabled.");
        const secret = newTotpSecret();
        const uri = provisioningUri(secret, user.email);
        const qrCodeDataUrl = await QRCode.toDataURL(uri, { width: 240, margin: 2 });
        const expiresAt = new Date(Date.now() + 10 * 60_000);
        await tx.update(users).set({ totpPendingEncrypted: encryptTotp(secret, key, user.id), totpPendingExpiresAt: expiresAt }).where(eq(users.id, user.id));
        return { user, setup: { secret, provisioningUri: uri, qrCodeDataUrl, expiresAt } };
      });
      // Audit inserts use a different connection and reference users by FK.
      // Emit after commit so their key-share lock cannot wait on our user lock.
      await this.event(result.user, "TWO_FACTOR_SETUP_STARTED", context);
      return result.setup;
    } catch (error) {
      await this.eventById(userId, "TWO_FACTOR_SETUP_FAILED", context);
      throw error;
    }
  }

  async enable(userId: string, version: number, code: string, reauthToken: string, context: Context) {
    await this.limits.check("2fa-factor", userId, 30, 300);
    try {
      const result = await this.db.transaction(async (tx) => {
        const user = await this.lockedUser(tx, userId, version);
        await this.flags.assertFeatureEnabled("enable2FA", tx);
        await this.consumeReauth(tx, userId, reauthToken, "2fa-enable");
        if (user.twoFactorEnabled || !user.totpPendingEncrypted || !user.totpPendingExpiresAt || user.totpPendingExpiresAt.getTime() <= Date.now()) {
          throw new BadRequestException("Start a new two-factor setup.");
        }
        const counter = await verifyTotp(decryptTotp(user.totpPendingEncrypted, this.requireKey(), user.id), code);
        if (counter === null) throw new UnauthorizedException("Invalid verification code.");
        const recoveryCodes = await this.replaceRecoveryCodes(tx, user.id);
        const [updated] = await tx.update(users).set({
          twoFactorEnabled: true, twoFactorEnabledAt: new Date(), totpSecretEncrypted: user.totpPendingEncrypted,
          totpPendingEncrypted: null, totpPendingExpiresAt: null, totpLastCounter: counter,
          authVersion: user.authVersion + 1, updatedAt: new Date(),
        }).where(eq(users.id, user.id)).returning();
        await tx.delete(challenges).where(eq(challenges.userId, user.id));
        await tx.delete(authReauthTokens).where(eq(authReauthTokens.userId, user.id));
        return { user: updated!, recoveryCodes };
      });
      await this.event(result.user, "TWO_FACTOR_ENABLED", context);
      return result;
    } catch (error) {
      await this.eventById(userId, "TWO_FACTOR_SETUP_FAILED", context);
      throw error;
    }
  }

  async completeLogin(challengeToken: string, code: string, context: Context) {
    // IP uses socket identity from controller, never untrusted forwarded headers.
    await this.limits.check("2fa-login-ip", context.ipAddress ?? "unknown", 100, 300);
    const tokenHash = hashCredential(challengeToken);
    const [hint] = await this.db.select({ userId: challenges.userId }).from(challenges).where(eq(challenges.tokenHash, tokenHash));
    if (!hint) {
      await this.eventById(null, "TWO_FACTOR_LOGIN_FAILED", context);
      throw new UnauthorizedException("Invalid or expired login challenge.");
    }
    await this.limits.check("2fa-factor", hint.userId, 30, 300);
    const result = await this.db.transaction(async (tx) => {
      const user = await this.lockedUser(tx, hint.userId);
      const [challenge] = await tx.select().from(challenges).where(eq(challenges.tokenHash, tokenHash)).for("update");
      if (!challenge || challenge.usedAt || challenge.attempts >= 5 || challenge.expiresAt.getTime() <= Date.now() || challenge.authVersion !== user.authVersion || !user.twoFactorEnabled) return { user, valid: false };
      await tx.update(challenges).set({ attempts: challenge.attempts + 1 }).where(eq(challenges.id, challenge.id));
      const factor = await this.consumeFactor(tx, user, code);
      if (!factor) return { user, valid: false };
      await tx.update(challenges).set({ usedAt: new Date() }).where(eq(challenges.id, challenge.id));
      return { user, valid: true, factor };
    });
    await this.event(result.user, result.valid ? "TWO_FACTOR_LOGIN_SUCCESS" : "TWO_FACTOR_LOGIN_FAILED", context);
    if (!result.valid) throw new UnauthorizedException("Invalid code or expired login challenge. Codes can only be used once.");
    if (result.factor === "RECOVERY") await this.event(result.user, "TWO_FACTOR_RECOVERY_USED", context);
    return result.user;
  }

  async manage(userId: string, version: number, code: string, reauthToken: string, action: "disable" | "regenerate", context: Context) {
    await this.limits.check("2fa-factor", userId, 30, 300);
    try {
      const result = await this.db.transaction(async (tx) => {
        const user = await this.lockedUser(tx, userId, version);
        await this.consumeReauth(tx, userId, reauthToken, action === "disable" ? "2fa-disable" : "2fa-recovery-regenerate");
        if (!user.twoFactorEnabled) throw new BadRequestException("Two-factor authentication is not enabled.");
        const factor = await this.consumeFactor(tx, user, code);
        if (!factor) throw new UnauthorizedException("Invalid verification code. Codes can only be used once.");
        if (action === "regenerate") return { user, factor, recoveryCodes: await this.replaceRecoveryCodes(tx, user.id) };
        await tx.delete(codes).where(eq(codes.userId, user.id));
        await tx.delete(challenges).where(eq(challenges.userId, user.id));
        await tx.delete(authReauthTokens).where(eq(authReauthTokens.userId, user.id));
        const [updated] = await tx.update(users).set({ twoFactorEnabled: false, twoFactorEnabledAt: null,
          totpSecretEncrypted: null, totpPendingEncrypted: null, totpPendingExpiresAt: null, totpLastCounter: null,
          authVersion: user.authVersion + 1, updatedAt: new Date(),
        }).where(eq(users.id, user.id)).returning();
        return { user: updated!, factor, recoveryCodes: undefined };
      });
      if (result.factor === "RECOVERY") await this.event(result.user, "TWO_FACTOR_RECOVERY_USED", context);
      await this.event(result.user, action === "disable" ? "TWO_FACTOR_DISABLED" : "TWO_FACTOR_RECOVERY_REGENERATED", context);
      return result;
    } catch (error) {
      await this.eventById(userId, action === "disable" ? "TWO_FACTOR_DISABLE_FAILED" : "TWO_FACTOR_RECOVERY_FAILED", context);
      throw error;
    }
  }

  private async consumeFactor(tx: Tx, user: User, code: string): Promise<"TOTP" | "RECOVERY" | null> {
    if (/^\d{6}$/.test(code)) {
      if (!user.totpSecretEncrypted) return null;
      const counter = await verifyTotp(decryptTotp(user.totpSecretEncrypted, this.requireKey(), user.id), code, user.totpLastCounter ?? undefined);
      if (counter === null) return null;
      await tx.update(users).set({ totpLastCounter: counter }).where(eq(users.id, user.id));
      return "TOTP";
    }
    const [consumed] = await tx.update(codes).set({ usedAt: new Date() }).where(and(eq(codes.userId, user.id), eq(codes.codeHash, recoveryHash(user.id, code)), isNull(codes.usedAt))).returning({ id: codes.id });
    return consumed ? "RECOVERY" : null;
  }

  private async replaceRecoveryCodes(tx: Tx, userId: string) {
    const recoveryCodes = newRecoveryCodes();
    await tx.delete(codes).where(eq(codes.userId, userId));
    await tx.insert(codes).values(recoveryCodes.map((code) => ({ userId, codeHash: recoveryHash(userId, code) })));
    return recoveryCodes;
  }

  private event(user: User, eventType: SecurityEventType, context: Context) {
    return this.events.recordEvent({ actorUserId: user.id, actorRole: user.role, targetType: "USER", targetId: user.id,
      eventType, severity: eventType.endsWith("FAILED") ? "WARNING" : "INFO", ...context });
  }
  private eventById(userId: string | null, eventType: SecurityEventType, context: Context) {
    return this.events.recordEvent({ actorUserId: userId, targetType: "USER", targetId: userId, eventType, severity: "WARNING", ...context });
  }
}
