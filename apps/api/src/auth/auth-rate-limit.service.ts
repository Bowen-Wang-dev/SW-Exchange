import { HttpException, Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { lt, sql } from "drizzle-orm";
import { DRIZZLE_DB, type Database } from "../db/database.module.js";
import { authRateLimits, authReauthTokens } from "../db/schema/index.js";
import { hashCredential } from "./two-factor.crypto.js";

@Injectable()
export class AuthRateLimitService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  onModuleInit() {
    this.cleanupTimer = setInterval(() => void this.cleanupExpired().catch(() => undefined), 60 * 60_000);
    this.cleanupTimer.unref?.();
    void this.cleanupExpired().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async cleanupExpired() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
    await this.db.delete(authReauthTokens).where(lt(authReauthTokens.expiresAt, cutoff));
    return this.db.delete(authRateLimits).where(lt(authRateLimits.windowStart, cutoff));
  }

  async check(scope: string, identity: string, limit: number, seconds: number) {
    const key = hashCredential(`${scope}:${identity}`);
    const windowStart = new Date(Math.floor(Date.now() / (seconds * 1000)) * seconds * 1000);
    const [row] = await this.db.insert(authRateLimits).values({ key, windowStart, attempts: 1 })
      .onConflictDoUpdate({ target: authRateLimits.key, set: {
        windowStart,
        attempts: sql`CASE WHEN ${authRateLimits.windowStart} = ${windowStart} THEN ${authRateLimits.attempts} + 1 ELSE 1 END`,
      } }).returning();
    if (!row || row.attempts > limit) throw new HttpException("Too many authentication attempts. Please try again later.", 429);
  }
}
