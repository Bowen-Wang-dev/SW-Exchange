ALTER TABLE "markets" ADD COLUMN "min_order_amount" numeric(78, 0) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "min_notional" numeric(78, 0) DEFAULT 0 NOT NULL;