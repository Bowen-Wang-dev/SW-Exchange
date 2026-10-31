ALTER TYPE "public"."security_event_type" ADD VALUE 'TWO_FACTOR_SETUP_STARTED' BEFORE 'EMAIL_VERIFICATION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'TWO_FACTOR_SETUP_FAILED' BEFORE 'EMAIL_VERIFICATION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'TWO_FACTOR_ENABLED' BEFORE 'EMAIL_VERIFICATION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'TWO_FACTOR_DISABLED' BEFORE 'EMAIL_VERIFICATION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'TWO_FACTOR_DISABLE_FAILED' BEFORE 'EMAIL_VERIFICATION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'TWO_FACTOR_LOGIN_REQUIRED' BEFORE 'EMAIL_VERIFICATION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'TWO_FACTOR_LOGIN_SUCCESS' BEFORE 'EMAIL_VERIFICATION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'TWO_FACTOR_LOGIN_FAILED' BEFORE 'EMAIL_VERIFICATION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'TWO_FACTOR_RECOVERY_USED' BEFORE 'EMAIL_VERIFICATION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'TWO_FACTOR_RECOVERY_REGENERATED' BEFORE 'EMAIL_VERIFICATION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'TWO_FACTOR_RECOVERY_FAILED' BEFORE 'EMAIL_VERIFICATION_REQUESTED';--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"attempts" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_factor_login_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"auth_version" integer NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "two_factor_login_challenges_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "two_factor_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "two_factor_recovery_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_secret_encrypted" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_pending_encrypted" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_pending_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_last_counter" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "two_factor_login_challenges" ADD CONSTRAINT "two_factor_login_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "two_factor_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "two_factor_challenge_user_idx" ON "two_factor_login_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_recovery_user_idx" ON "two_factor_recovery_codes" USING btree ("user_id");