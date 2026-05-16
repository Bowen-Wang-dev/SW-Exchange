DO $$ BEGIN
 CREATE TYPE "public"."wallet_type" AS ENUM('MAIN', 'FEE', 'TREASURY', 'AIRDROP', 'HOT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."ledger_entry_type" ADD VALUE IF NOT EXISTS 'ADMIN_BUCKET_TRANSFER_OUT' BEFORE 'ADMIN_ADJUST';--> statement-breakpoint
ALTER TYPE "public"."ledger_entry_type" ADD VALUE IF NOT EXISTS 'ADMIN_BUCKET_TRANSFER_IN' BEFORE 'ADMIN_ADJUST';--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "wallet_type" "wallet_type" DEFAULT 'MAIN' NOT NULL;--> statement-breakpoint
ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallets_user_id_asset_id_unique";--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_asset_id_wallet_type_unique" UNIQUE("user_id","asset_id","wallet_type");
