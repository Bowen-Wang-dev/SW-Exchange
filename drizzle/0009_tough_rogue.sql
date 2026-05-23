ALTER TYPE "public"."order_status" ADD VALUE 'PARTIAL_FILLED_CANCELLED' BEFORE 'CANCELLED';--> statement-breakpoint
ALTER TYPE "public"."order_type" ADD VALUE 'MARKET';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "requested_quote_amount" numeric(78, 0) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "spent_quote_amount" numeric(78, 0) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "average_price" numeric(78, 0) DEFAULT 0 NOT NULL;