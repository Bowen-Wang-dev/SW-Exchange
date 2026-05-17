import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
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
export const orderTypeEnum = pgEnum("order_type", ["LIMIT"]);
export const orderStatusEnum = pgEnum("order_status", [
  "OPEN",
  "PARTIAL_FILLED",
  "FILLED",
  "CANCELLED",
  "REJECTED",
]);
export const tradeStatusEnum = pgEnum("trade_status", ["SETTLED", "REVERSED"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  nickname: varchar("nickname", { length: 64 }),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("USER"),
  status: userStatusEnum("status").notNull().default("ACTIVE"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
