ALTER TYPE "public"."security_event_type" ADD VALUE 'EMAIL_VERIFICATION_REQUESTED' BEFORE 'ADMIN_ACTION_CONFIRMED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'EMAIL_VERIFICATION_SENT' BEFORE 'ADMIN_ACTION_CONFIRMED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'EMAIL_VERIFICATION_CONFIRMED' BEFORE 'ADMIN_ACTION_CONFIRMED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'EMAIL_VERIFICATION_FAILED' BEFORE 'ADMIN_ACTION_CONFIRMED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'EMAIL_VERIFICATION_TOKEN_EXPIRED' BEFORE 'ADMIN_ACTION_CONFIRMED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'EMAIL_VERIFICATION_TOKEN_REUSED' BEFORE 'ADMIN_ACTION_CONFIRMED';--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"purpose" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"requested_ip" varchar(128),
	"requested_user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_purpose_idx" ON "email_verification_tokens" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_email_idx" ON "email_verification_tokens" USING btree ("email");