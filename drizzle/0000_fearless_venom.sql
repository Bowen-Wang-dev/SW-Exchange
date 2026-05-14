CREATE TYPE "public"."ledger_entry_type" AS ENUM('AIRDROP', 'TRANSFER_IN', 'TRANSFER_OUT', 'ORDER_LOCK', 'ORDER_UNLOCK', 'TRADE_BUY', 'TRADE_SELL', 'FEE', 'ADMIN_ADJUST');--> statement-breakpoint
CREATE TYPE "public"."market_status" AS ENUM('ACTIVE', 'PAUSED');--> statement-breakpoint
CREATE TYPE "public"."order_side" AS ENUM('BUY', 'SELL');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('OPEN', 'PARTIAL_FILLED', 'FILLED', 'CANCELLED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('LIMIT');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('SETTLED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('SUCCESS', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'FROZEN', 'BANNED');--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"action" varchar(128) NOT NULL,
	"target_type" varchar(64) NOT NULL,
	"target_id" uuid,
	"before_value" jsonb,
	"after_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(16) NOT NULL,
	"name" varchar(128) NOT NULL,
	"decimals" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"type" "ledger_entry_type" NOT NULL,
	"amount" bigint NOT NULL,
	"balance_available_after" bigint NOT NULL,
	"balance_locked_after" bigint NOT NULL,
	"ref_type" varchar(64) NOT NULL,
	"ref_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"base_asset_id" uuid NOT NULL,
	"quote_asset_id" uuid NOT NULL,
	"status" "market_status" DEFAULT 'ACTIVE' NOT NULL,
	"price_decimals" integer DEFAULT 18 NOT NULL,
	"amount_decimals" integer DEFAULT 18 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "markets_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"side" "order_side" NOT NULL,
	"type" "order_type" DEFAULT 'LIMIT' NOT NULL,
	"status" "order_status" DEFAULT 'OPEN' NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"filled_amount" bigint DEFAULT 0 NOT NULL,
	"locked_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"buy_order_id" uuid NOT NULL,
	"sell_order_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"buyer_fee" bigint DEFAULT 0 NOT NULL,
	"seller_fee" bigint DEFAULT 0 NOT NULL,
	"status" "trade_status" DEFAULT 'SETTLED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" uuid,
	"to_user_id" uuid,
	"asset_id" uuid,
	"amount" bigint DEFAULT 0 NOT NULL,
	"status" "transfer_status" DEFAULT 'SUCCESS' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"available_balance" bigint DEFAULT 0 NOT NULL,
	"locked_balance" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_asset_id_unique" UNIQUE("user_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_base_asset_id_assets_id_fk" FOREIGN KEY ("base_asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_quote_asset_id_assets_id_fk" FOREIGN KEY ("quote_asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_buy_order_id_orders_id_fk" FOREIGN KEY ("buy_order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_sell_order_id_orders_id_fk" FOREIGN KEY ("sell_order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;