ALTER TABLE "orders" ADD COLUMN "remaining_amount" numeric(78, 0) DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "orders" SET "remaining_amount" = "amount" - "filled_amount";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "locked_asset_id" uuid;--> statement-breakpoint
UPDATE "orders"
SET "locked_asset_id" = CASE
  WHEN "orders"."side" = 'BUY' THEN "markets"."quote_asset_id"
  ELSE "markets"."base_asset_id"
END
FROM "markets"
WHERE "orders"."market_id" = "markets"."id"
  AND "orders"."locked_asset_id" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "locked_asset_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_locked_asset_id_assets_id_fk" FOREIGN KEY ("locked_asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;
