CREATE TYPE "public"."security_event_severity" AS ENUM('INFO', 'WARNING', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."security_event_type" AS ENUM('AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILED', 'AUTH_LOGOUT', 'ADMIN_ACTION_CONFIRMED', 'FEATURE_FLAG_READ_ADMIN', 'SENSITIVE_ACTION_REQUIRED', 'SENSITIVE_ACTION_CONFIRMED', 'SENSITIVE_ACTION_REJECTED', 'USER_STATUS_CHANGED', 'ASSET_STATUS_CHANGED', 'MARKET_STATUS_CHANGED', 'FEE_SETTINGS_UPDATED', 'ADMIN_AIRDROP_CREATED', 'ADMIN_WALLET_TRANSFER_CREATED');--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_role" "user_role",
	"event_type" "security_event_type" NOT NULL,
	"severity" "security_event_severity" NOT NULL,
	"target_type" varchar(64),
	"target_id" uuid,
	"ip_address" varchar(128),
	"user_agent" text,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_events_created_at_idx" ON "security_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "security_events_event_type_idx" ON "security_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "security_events_severity_idx" ON "security_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "security_events_actor_user_id_idx" ON "security_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "security_events_target_type_idx" ON "security_events" USING btree ("target_type");