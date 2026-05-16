ALTER TABLE "users" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "fee_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" uuid NOT NULL,
	"market_symbol" varchar(32) NOT NULL,
	"buyer_fee_rate_bps" integer DEFAULT 10 NOT NULL,
	"seller_fee_rate_bps" integer DEFAULT 10 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_settings_market_symbol_unique" UNIQUE("market_symbol")
);
--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "buyer_fee_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "seller_fee_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "buyer_fee_rate_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "seller_fee_rate_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "trades"
SET
  "buyer_fee_asset_id" = "markets"."base_asset_id",
  "seller_fee_asset_id" = "markets"."quote_asset_id"
FROM "markets"
WHERE "trades"."market_id" = "markets"."id"
  AND (
    "trades"."buyer_fee_asset_id" IS NULL
    OR "trades"."seller_fee_asset_id" IS NULL
  );--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "buyer_fee_asset_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "seller_fee_asset_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_settings" ADD CONSTRAINT "fee_settings_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_buyer_fee_asset_id_assets_id_fk" FOREIGN KEY ("buyer_fee_asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_seller_fee_asset_id_assets_id_fk" FOREIGN KEY ("seller_fee_asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;
