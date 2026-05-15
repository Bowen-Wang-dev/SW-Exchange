ALTER TABLE "ledger_entries" ALTER COLUMN "amount" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "ledger_entries" ALTER COLUMN "balance_available_after" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "ledger_entries" ALTER COLUMN "balance_locked_after" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "price" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "price" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "amount" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "filled_amount" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "filled_amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "locked_amount" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "locked_amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "price" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "price" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "amount" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "buyer_fee" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "buyer_fee" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "seller_fee" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "trades" ALTER COLUMN "seller_fee" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "transfers" ALTER COLUMN "amount" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "transfers" ALTER COLUMN "amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "wallets" ALTER COLUMN "available_balance" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "wallets" ALTER COLUMN "available_balance" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "wallets" ALTER COLUMN "locked_balance" SET DATA TYPE numeric(78, 0);--> statement-breakpoint
ALTER TABLE "wallets" ALTER COLUMN "locked_balance" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nickname" varchar(64);