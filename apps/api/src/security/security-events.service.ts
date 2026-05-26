import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import {
  isSecurityEventSeverity,
  isSecurityEventType,
  type SecurityEventSeverity,
  type SecurityEventType,
  type UserRole,
} from "@sw-exchange/shared";
import { and, desc, eq, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { securityEvents, users } from "../db/schema/index.js";

const DEFAULT_EVENT_LIMIT = 100;
const MAX_EVENT_LIMIT = 250;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_OBJECT_KEYS = 40;
const MAX_METADATA_ARRAY_ITEMS = 25;
const MAX_STRING_LENGTH = 500;
const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_METADATA_KEY_FRAGMENTS = [
  "password",
  "passcode",
  "secret",
  "token",
  "jwt",
  "bearer",
  "authorization",
  "cookie",
  "privatekey",
  "mnemonic",
  "seedphrase",
  "totp",
  "otp",
  "backupcode",
  "verificationcode",
  "accesskey",
  "apikey",
] as const;

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string | undefined;
  socket?: {
    remoteAddress?: string | undefined;
  };
};

export type SecurityEventInput = {
  actorUserId?: string | null;
  actorRole?: UserRole | null;
  eventType: SecurityEventType;
  severity: SecurityEventSeverity;
  targetType?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
};

export type SecurityEventListQuery = {
  eventType?: string;
  severity?: string;
  actorUserId?: string;
  targetType?: string;
  search?: string;
  limit?: string | number;
};

type SecurityEventRow = typeof securityEvents.$inferSelect;

type SecurityEventActor = {
  id: string;
  email: string;
  username: string;
} | null;

export type SecurityEventRecord = Omit<SecurityEventRow, "metadata"> & {
  actorUser: SecurityEventActor;
  metadata: unknown;
};

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger(SecurityEventsService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async recordEvent(
    input: SecurityEventInput,
    options: { swallowErrors?: boolean } = {},
  ): Promise<void> {
    const swallowErrors = options.swallowErrors ?? true;

    try {
      await this.db.insert(securityEvents).values({
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        eventType: input.eventType,
        severity: input.severity,
        targetType: this.normalizeShortText(input.targetType),
        targetId: this.normalizeShortText(input.targetId),
        ipAddress: this.normalizeShortText(input.ipAddress, 128),
        userAgent: this.normalizeLongText(input.userAgent),
        metadata: this.normalizeEventMetadata(input.metadata),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record security event ${input.eventType}: ${error instanceof Error ? error.message : String(error)}`,
      );

      if (!swallowErrors) {
        throw error;
      }
    }
  }

  async listEvents(query: SecurityEventListQuery = {}): Promise<SecurityEventRecord[]> {
    const normalizedQuery = this.normalizeListQuery(query);
    const conditions: SQL<unknown>[] = [];

    if (normalizedQuery.eventType) {
      conditions.push(eq(securityEvents.eventType, normalizedQuery.eventType));
    }

    if (normalizedQuery.severity) {
      conditions.push(eq(securityEvents.severity, normalizedQuery.severity));
    }

    if (normalizedQuery.actorUserId) {
      conditions.push(eq(securityEvents.actorUserId, normalizedQuery.actorUserId));
    }

    if (normalizedQuery.targetType) {
      conditions.push(eq(securityEvents.targetType, normalizedQuery.targetType));
    }

    if (normalizedQuery.search) {
      const pattern = `%${this.escapeLikePattern(normalizedQuery.search)}%`;
      conditions.push(
        or(
          sql`${securityEvents.eventType}::text ilike ${pattern} escape '\\'`,
          sql`${securityEvents.targetType}::text ilike ${pattern} escape '\\'`,
          sql`${securityEvents.targetId}::text ilike ${pattern} escape '\\'`,
          sql`${securityEvents.actorUserId}::text ilike ${pattern} escape '\\'`,
          sql`${securityEvents.ipAddress}::text ilike ${pattern} escape '\\'`,
          sql`${securityEvents.userAgent}::text ilike ${pattern} escape '\\'`,
          sql`${securityEvents.metadata}::text ilike ${pattern} escape '\\'`,
          sql`${users.email}::text ilike ${pattern} escape '\\'`,
          sql`${users.username}::text ilike ${pattern} escape '\\'`,
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({
        id: securityEvents.id,
        createdAt: securityEvents.createdAt,
        actorUserId: securityEvents.actorUserId,
        actorRole: securityEvents.actorRole,
        eventType: securityEvents.eventType,
        severity: securityEvents.severity,
        targetType: securityEvents.targetType,
        targetId: securityEvents.targetId,
        ipAddress: securityEvents.ipAddress,
        userAgent: securityEvents.userAgent,
        metadata: securityEvents.metadata,
        actorId: users.id,
        actorEmail: users.email,
        actorUsername: users.username,
      })
      .from(securityEvents)
      .leftJoin(users, eq(securityEvents.actorUserId, users.id))
      .where(whereClause)
      .orderBy(desc(securityEvents.createdAt))
      .limit(normalizedQuery.limit);

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      actorUserId: row.actorUserId,
      actorRole: row.actorRole,
      eventType: row.eventType,
      severity: row.severity,
      targetType: row.targetType,
      targetId: row.targetId,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      metadata: row.metadata,
      actorUser:
        row.actorId && row.actorEmail && row.actorUsername
          ? {
              id: row.actorId,
              email: row.actorEmail,
              username: row.actorUsername,
            }
          : null,
    }));
  }

  async getEventById(id: string): Promise<SecurityEventRecord | null> {
    const [row] = await this.db
      .select({
        id: securityEvents.id,
        createdAt: securityEvents.createdAt,
        actorUserId: securityEvents.actorUserId,
        actorRole: securityEvents.actorRole,
        eventType: securityEvents.eventType,
        severity: securityEvents.severity,
        targetType: securityEvents.targetType,
        targetId: securityEvents.targetId,
        ipAddress: securityEvents.ipAddress,
        userAgent: securityEvents.userAgent,
        metadata: securityEvents.metadata,
        actorId: users.id,
        actorEmail: users.email,
        actorUsername: users.username,
      })
      .from(securityEvents)
      .leftJoin(users, eq(securityEvents.actorUserId, users.id))
      .where(eq(securityEvents.id, id))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      createdAt: row.createdAt,
      actorUserId: row.actorUserId,
      actorRole: row.actorRole,
      eventType: row.eventType,
      severity: row.severity,
      targetType: row.targetType,
      targetId: row.targetId,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      metadata: row.metadata,
      actorUser:
        row.actorId && row.actorEmail && row.actorUsername
          ? {
              id: row.actorId,
              email: row.actorEmail,
              username: row.actorUsername,
            }
          : null,
    };
  }

  normalizeEventMetadata(input: unknown): unknown {
    const normalized = this.normalizeMetadataValue(input, 0, undefined);

    if (normalized === undefined || normalized === null) {
      return null;
    }

    if (Array.isArray(normalized)) {
      return normalized.length > 0 ? normalized : null;
    }

    if (typeof normalized === "object" && Object.keys(normalized).length === 0) {
      return null;
    }

    return normalized;
  }

  private normalizeListQuery(query: SecurityEventListQuery) {
    const eventTypeRaw = query.eventType?.trim();
    const severityRaw = query.severity?.trim();

    if (eventTypeRaw && !isSecurityEventType(eventTypeRaw)) {
      throw new BadRequestException("Invalid security event type filter.");
    }

    if (severityRaw && !isSecurityEventSeverity(severityRaw)) {
      throw new BadRequestException("Invalid security event severity filter.");
    }

    const eventType = eventTypeRaw && isSecurityEventType(eventTypeRaw) ? eventTypeRaw : undefined;
    const severity =
      severityRaw && isSecurityEventSeverity(severityRaw) ? severityRaw : undefined;

    const rawLimit =
      typeof query.limit === "number" ? query.limit : Number.parseInt(query.limit ?? "", 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_EVENT_LIMIT)
      : DEFAULT_EVENT_LIMIT;

    return {
      eventType: eventType ?? undefined,
      severity: severity ?? undefined,
      actorUserId: this.normalizeShortText(query.actorUserId),
      targetType: this.normalizeShortText(query.targetType),
      search: this.normalizeShortText(query.search, 120),
      limit,
    };
  }

  private normalizeMetadataValue(
    value: unknown,
    depth: number,
    keyName: string | undefined,
  ): unknown {
    if (depth > MAX_METADATA_DEPTH) {
      return "[TRUNCATED_DEPTH]";
    }

    if (keyName && this.isSensitiveMetadataKey(keyName)) {
      return REDACTED_VALUE;
    }

    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string") {
      if (this.looksSensitiveString(value)) {
        return REDACTED_VALUE;
      }

      return value.length > MAX_STRING_LENGTH
        ? `${value.slice(0, MAX_STRING_LENGTH)}...`
        : value;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : String(value);
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: this.normalizeMetadataValue(value.message, depth + 1, "errorMessage"),
      };
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, MAX_METADATA_ARRAY_ITEMS)
        .map((item) => this.normalizeMetadataValue(item, depth + 1, keyName))
        .filter((item) => item !== undefined);
    }

    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_METADATA_OBJECT_KEYS);
      const normalizedEntries = entries
        .map(([entryKey, entryValue]) => [
          entryKey,
          this.normalizeMetadataValue(entryValue, depth + 1, entryKey),
        ] as const)
        .filter(([, entryValue]) => entryValue !== undefined);

      return Object.fromEntries(normalizedEntries);
    }

    return String(value);
  }

  private isSensitiveMetadataKey(key: string) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return SENSITIVE_METADATA_KEY_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment));
  }

  private looksSensitiveString(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }

    if (/^bearer\s+/i.test(trimmed)) {
      return true;
    }

    return /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(trimmed);
  }

  private normalizeShortText(value: string | null | undefined, maxLength = 64) {
    const normalized = this.normalizeLongText(value, maxLength);
    return normalized ? normalized : null;
  }

  private normalizeLongText(value: string | null | undefined, maxLength = 1024) {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
  }

  private escapeLikePattern(value: string) {
    return value.replace(/[\\%_]/g, "\\$&");
  }
}

export function extractRequestSecurityContext(request?: RequestLike) {
  const forwardedFor = request?.headers?.["x-forwarded-for"];
  const realIp = request?.headers?.["x-real-ip"];
  const userAgentHeader = request?.headers?.["user-agent"];

  const ipAddress = firstHeaderValue(forwardedFor) ?? firstHeaderValue(realIp) ?? request?.ip ?? request?.socket?.remoteAddress ?? null;
  const userAgent = firstHeaderValue(userAgentHeader) ?? null;

  return {
    ipAddress: ipAddress ? ipAddress.split(",")[0]!.trim() : null,
    userAgent: userAgent ? userAgent.trim() : null,
  };
}

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
