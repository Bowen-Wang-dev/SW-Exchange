import {
  boolean,
  integer,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["USER", "ADMIN"]);
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "FROZEN", "BANNED"]);
export const walletTypeValues = ["MAIN", "FEE", "TREASURY", "AIRDROP", "HOT"] as const;
export type WalletType = (typeof walletTypeValues)[number];
export const walletTypeEnum = pgEnum("wallet_type", walletTypeValues);
export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "AIRDROP",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "ORDER_LOCK",
  "ORDER_UNLOCK",
  "TRADE_BUY",
  "TRADE_SELL",
  "FEE",
  "ADMIN_BUCKET_TRANSFER_OUT",
  "ADMIN_BUCKET_TRANSFER_IN",
  "ADMIN_ADJUST",
]);
export const transferStatusEnum = pgEnum("transfer_status", ["SUCCESS", "FAILED"]);
export const marketStatusEnum = pgEnum("market_status", ["ACTIVE", "PAUSED"]);
export const orderSideEnum = pgEnum("order_side", ["BUY", "SELL"]);
export const orderTypeEnum = pgEnum("order_type", ["LIMIT", "MARKET"]);
export const orderStatusEnum = pgEnum("order_status", [
  "OPEN",
  "PARTIAL_FILLED",
  "FILLED",
  "PARTIAL_FILLED_CANCELLED",
  "CANCELLED",
  "REJECTED",
]);
export const tradeStatusEnum = pgEnum("trade_status", ["SETTLED", "REVERSED"]);
export const securityEventSeverityEnum = pgEnum("security_event_severity", [
  "INFO",
  "WARNING",
  "CRITICAL",
]);
export const securityEventTypeEnum = pgEnum("security_event_type", [
  "ADMIN_ROLE_ASSIGNED",
  "ADMIN_ROLE_REMOVED",
  "ADMIN_ROLES_UPDATED",
  "ADMIN_ACCESS_DENIED",
  "ADMIN_PRIVILEGE_ESCALATION_REJECTED",
  "ADMIN_LAST_SUPER_ADMIN_PROTECTED",
  "ADMIN_ROLES_BOOTSTRAPPED",
  "AUTH_LOGIN_SUCCESS",
  "AUTH_LOGIN_FAILED",
  "AUTH_LOGOUT",
  "TWO_FACTOR_SETUP_STARTED",
  "TWO_FACTOR_SETUP_FAILED",
  "TWO_FACTOR_ENABLED",
  "TWO_FACTOR_DISABLED",
  "TWO_FACTOR_DISABLE_FAILED",
  "TWO_FACTOR_LOGIN_REQUIRED",
  "TWO_FACTOR_LOGIN_SUCCESS",
  "TWO_FACTOR_LOGIN_FAILED",
  "TWO_FACTOR_RECOVERY_USED",
  "TWO_FACTOR_RECOVERY_REGENERATED",
  "TWO_FACTOR_RECOVERY_FAILED",

  "EMAIL_VERIFICATION_REQUESTED",
  "EMAIL_VERIFICATION_SENT",
  "EMAIL_VERIFICATION_CONFIRMED",
  "EMAIL_VERIFICATION_FAILED",
  "EMAIL_VERIFICATION_TOKEN_EXPIRED",
  "EMAIL_VERIFICATION_TOKEN_REUSED",
  "ADMIN_ACTION_CONFIRMED",
  "FEATURE_FLAG_READ_ADMIN",
  "SENSITIVE_ACTION_REQUIRED",
  "SENSITIVE_ACTION_CONFIRMED",
  "SENSITIVE_ACTION_REJECTED",
  "USER_STATUS_CHANGED",
  "ASSET_STATUS_CHANGED",
  "MARKET_STATUS_CHANGED",
  "FEE_SETTINGS_UPDATED",
  "ADMIN_AIRDROP_CREATED",
  "ADMIN_WALLET_TRANSFER_CREATED",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  nickname: varchar("nickname", { length: 64 }),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("USER"),
  status: userStatusEnum("status").notNull().default("ACTIVE"),
  isSystem: boolean("is_system").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorEnabledAt: timestamp("two_factor_enabled_at", { withTimezone: true }),
  totpSecretEncrypted: text("totp_secret_encrypted"),
  totpPendingEncrypted: text("totp_pending_encrypted"),
  totpPendingExpiresAt: timestamp("totp_pending_expires_at", { withTimezone: true }),
  totpLastCounter: integer("totp_last_counter"),
  authVersion: integer("auth_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminRoles = pgTable("admin_roles", {
  key: varchar("key", { length: 64 }).primaryKey(),
  description: text("description").notNull(),
});
export const adminPermissions = pgTable("admin_permissions", {
  key: varchar("key", { length: 64 }).primaryKey(),
});
export const adminRolePermissions = pgTable("admin_role_permissions", {
  roleKey: varchar("role_key", { length: 64 }).notNull().references(() => adminRoles.key, { onDelete: "cascade" }),
  permissionKey: varchar("permission_key", { length: 64 }).notNull().references(() => adminPermissions.key, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.roleKey, t.permissionKey] }), index("admin_role_permissions_permission_idx").on(t.permissionKey)]);
export const userAdminRoles = pgTable("user_admin_roles", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleKey: varchar("role_key", { length: 64 }).notNull().references(() => adminRoles.key),
  assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.roleKey] }), index("user_admin_roles_role_idx").on(t.roleKey), index("user_admin_roles_actor_idx").on(t.assignedBy)]);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    purpose: varchar("purpose", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    requestedIp: varchar("requested_ip", { length: 128 }),
    requestedUserAgent: text("requested_user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailVerificationTokensTokenHashUnique: unique().on(table.tokenHash),
    emailVerificationTokensUserPurposeIdx: index("email_verification_tokens_user_purpose_idx").on(
      table.userId,
      table.purpose,
    ),
    emailVerificationTokensExpiresAtIdx: index("email_verification_tokens_expires_at_idx").on(
      table.expiresAt,
    ),
    emailVerificationTokensEmailIdx: index("email_verification_tokens_email_idx").on(table.email),
  }),
);

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  symbol: varchar("symbol", { length: 16 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  displayName: varchar("display_name", { length: 128 }),
  iconUrl: text("icon_url"),
  iconSource: varchar("icon_source", { length: 32 }),
  sortOrder: integer("sort_order"),
  description: text("description"),
  decimals: integer("decimals").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    walletType: walletTypeEnum("wallet_type").notNull().default("MAIN"),
    availableBalance: numeric("available_balance", { precision: 78, scale: 0, mode: "bigint" })
      .notNull()
      .default(sql`0`),
    lockedBalance: numeric("locked_balance", { precision: 78, scale: 0, mode: "bigint" })
      .notNull()
      .default(sql`0`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    walletUserAssetTypeUnique: unique().on(table.userId, table.assetId, table.walletType),
  }),
);

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "restrict" }),
  type: ledgerEntryTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 78, scale: 0, mode: "bigint" }).notNull(),
  balanceAvailableAfter: numeric("balance_available_after", {
    precision: 78,
    scale: 0,
    mode: "bigint",
  }).notNull(),
  balanceLockedAfter: numeric("balance_locked_after", {
    precision: 78,
    scale: 0,
    mode: "bigint",
  }).notNull(),
  refType: varchar("ref_type", { length: 64 }).notNull(),
  refId: uuid("ref_id"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: uuid("admin_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  action: varchar("action", { length: 128 }).notNull(),
  targetType: varchar("target_type", { length: 64 }).notNull(),
  targetId: uuid("target_id"),
  beforeValue: jsonb("before_value"),
  afterValue: jsonb("after_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const featureFlags = pgTable("feature_flags", {
  key: varchar("key", { length: 64 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: userRoleEnum("actor_role"),
    eventType: securityEventTypeEnum("event_type").notNull(),
    severity: securityEventSeverityEnum("severity").notNull(),
    targetType: varchar("target_type", { length: 64 }),
    targetId: uuid("target_id"),
    ipAddress: varchar("ip_address", { length: 128 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    securityEventsCreatedAtIdx: index("security_events_created_at_idx").on(table.createdAt),
    securityEventsEventTypeIdx: index("security_events_event_type_idx").on(table.eventType),
    securityEventsSeverityIdx: index("security_events_severity_idx").on(table.severity),
    securityEventsActorUserIdIdx: index("security_events_actor_user_id_idx").on(table.actorUserId),
    securityEventsTargetTypeIdx: index("security_events_target_type_idx").on(table.targetType),
  }),
);

export const transfers = pgTable("transfers", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromUserId: uuid("from_user_id").references(() => users.id, { onDelete: "set null" }),
  toUserId: uuid("to_user_id").references(() => users.id, { onDelete: "set null" }),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  status: transferStatusEnum("status").notNull().default("SUCCESS"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const markets = pgTable("markets", {
  id: uuid("id").defaultRandom().primaryKey(),
  symbol: varchar("symbol", { length: 32 }).notNull().unique(),
  baseAssetId: uuid("base_asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "restrict" }),
  quoteAssetId: uuid("quote_asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "restrict" }),
  status: marketStatusEnum("status").notNull().default("ACTIVE"),
  priceDecimals: integer("price_decimals").notNull().default(18),
  amountDecimals: integer("amount_decimals").notNull().default(18),
  minOrderAmount: numeric("min_order_amount", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  minNotional: numeric("min_notional", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feeSettings = pgTable(
  "fee_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "restrict" }),
    marketSymbol: varchar("market_symbol", { length: 32 }).notNull(),
    buyerFeeRateBps: integer("buyer_fee_rate_bps").notNull().default(10),
    sellerFeeRateBps: integer("seller_fee_rate_bps").notNull().default(10),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    feeSettingsMarketSymbolUnique: unique().on(table.marketSymbol),
  }),
);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  marketId: uuid("market_id")
    .notNull()
    .references(() => markets.id, { onDelete: "restrict" }),
  side: orderSideEnum("side").notNull(),
  type: orderTypeEnum("type").notNull().default("LIMIT"),
  status: orderStatusEnum("status").notNull().default("OPEN"),
  price: numeric("price", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  amount: numeric("amount", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  filledAmount: numeric("filled_amount", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  remainingAmount: numeric("remaining_amount", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  requestedQuoteAmount: numeric("requested_quote_amount", {
    precision: 78,
    scale: 0,
    mode: "bigint",
  })
    .notNull()
    .default(sql`0`),
  spentQuoteAmount: numeric("spent_quote_amount", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  averagePrice: numeric("average_price", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  lockedAssetId: uuid("locked_asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "restrict" }),
  lockedAmount: numeric("locked_amount", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

export const trades = pgTable("trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  marketId: uuid("market_id")
    .notNull()
    .references(() => markets.id, { onDelete: "restrict" }),
  buyOrderId: uuid("buy_order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "restrict" }),
  sellOrderId: uuid("sell_order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "restrict" }),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  price: numeric("price", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  amount: numeric("amount", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  quoteAmount: numeric("quote_amount", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  buyerFee: numeric("buyer_fee", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  sellerFee: numeric("seller_fee", { precision: 78, scale: 0, mode: "bigint" })
    .notNull()
    .default(sql`0`),
  buyerFeeAssetId: uuid("buyer_fee_asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "restrict" }),
  sellerFeeAssetId: uuid("seller_fee_asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "restrict" }),
  buyerFeeRateBps: integer("buyer_fee_rate_bps").notNull().default(0),
  sellerFeeRateBps: integer("seller_fee_rate_bps").notNull().default(0),
  status: tradeStatusEnum("status").notNull().default("SETTLED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Authentication-only state; user row locks serialize factor/challenge consumption.
export const twoFactorRecoveryCodes = pgTable("two_factor_recovery_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: varchar("code_hash", { length: 64 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  usedAt: timestamp("used_at", { withTimezone: true }),
}, (t) => ({ userIdx: index("two_factor_recovery_user_idx").on(t.userId) }));

export const twoFactorLoginChallenges = pgTable("two_factor_login_challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  authVersion: integer("auth_version").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ userIdx: index("two_factor_challenge_user_idx").on(t.userId) }));

export const authRateLimits = pgTable("auth_rate_limits", {
  key: varchar("key", { length: 64 }).primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull(),
});

export const authReauthTokens = pgTable("auth_reauth_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  purpose: varchar("purpose", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ userIdx: index("auth_reauth_tokens_user_idx").on(t.userId) }));
