ALTER TYPE "public"."security_event_type" ADD VALUE 'ADMIN_ROLE_ASSIGNED' BEFORE 'AUTH_LOGIN_SUCCESS';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'ADMIN_ROLE_REMOVED' BEFORE 'AUTH_LOGIN_SUCCESS';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'ADMIN_ROLES_UPDATED' BEFORE 'AUTH_LOGIN_SUCCESS';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'ADMIN_ACCESS_DENIED' BEFORE 'AUTH_LOGIN_SUCCESS';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'ADMIN_PRIVILEGE_ESCALATION_REJECTED' BEFORE 'AUTH_LOGIN_SUCCESS';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'ADMIN_LAST_SUPER_ADMIN_PROTECTED' BEFORE 'AUTH_LOGIN_SUCCESS';--> statement-breakpoint
ALTER TYPE "public"."security_event_type" ADD VALUE 'ADMIN_ROLES_BOOTSTRAPPED' BEFORE 'AUTH_LOGIN_SUCCESS';--> statement-breakpoint
CREATE TABLE "admin_permissions" (
	"key" varchar(64) PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_role_permissions" (
	"role_key" varchar(64) NOT NULL,
	"permission_key" varchar(64) NOT NULL,
	CONSTRAINT "admin_role_permissions_role_key_permission_key_pk" PRIMARY KEY("role_key","permission_key")
);
--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_admin_roles" (
	"user_id" uuid NOT NULL,
	"role_key" varchar(64) NOT NULL,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_admin_roles_user_id_role_key_pk" PRIMARY KEY("user_id","role_key")
);
--> statement-breakpoint
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_role_key_admin_roles_key_fk" FOREIGN KEY ("role_key") REFERENCES "public"."admin_roles"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_role_permissions" ADD CONSTRAINT "admin_role_permissions_permission_key_admin_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."admin_permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_admin_roles" ADD CONSTRAINT "user_admin_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_admin_roles" ADD CONSTRAINT "user_admin_roles_role_key_admin_roles_key_fk" FOREIGN KEY ("role_key") REFERENCES "public"."admin_roles"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_admin_roles" ADD CONSTRAINT "user_admin_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_role_permissions_permission_idx" ON "admin_role_permissions" USING btree ("permission_key");--> statement-breakpoint
CREATE INDEX "user_admin_roles_role_idx" ON "user_admin_roles" USING btree ("role_key");--> statement-breakpoint
CREATE INDEX "user_admin_roles_actor_idx" ON "user_admin_roles" USING btree ("assigned_by");
--> statement-breakpoint
-- Versioned canonical registry; never changes the feature flag default.
INSERT INTO admin_permissions(key) VALUES ('users.read'),('users.manage'),('assets.read'),('assets.manage'),('markets.read'),('markets.manage'),('fees.read'),('fees.manage'),('wallets.read'),('wallets.manage'),('airdrops.execute'),('reports.read'),('orders.read'),('trades.read'),('transfers.read'),('ledger.read'),('audit.read'),('feature_flags.read'),('admin_roles.read'),('admin_roles.manage');
--> statement-breakpoint
INSERT INTO admin_roles(key,description) VALUES ('super_admin','Full administrative authority, including financial operations and role management.'),('operator','Read operations and manage ordinary user status, assets and markets. No financial mutations or administrator management.'),('viewer','Read-only administrative review. No mutations.');
--> statement-breakpoint
INSERT INTO admin_role_permissions(role_key,permission_key) VALUES ('super_admin','users.read'),('super_admin','users.manage'),('super_admin','assets.read'),('super_admin','assets.manage'),('super_admin','markets.read'),('super_admin','markets.manage'),('super_admin','fees.read'),('super_admin','fees.manage'),('super_admin','wallets.read'),('super_admin','wallets.manage'),('super_admin','airdrops.execute'),('super_admin','reports.read'),('super_admin','orders.read'),('super_admin','trades.read'),('super_admin','transfers.read'),('super_admin','ledger.read'),('super_admin','audit.read'),('super_admin','feature_flags.read'),('super_admin','admin_roles.read'),('super_admin','admin_roles.manage'),('operator','users.read'),('operator','assets.read'),('operator','markets.read'),('operator','fees.read'),('operator','wallets.read'),('operator','reports.read'),('operator','orders.read'),('operator','trades.read'),('operator','transfers.read'),('operator','ledger.read'),('operator','audit.read'),('operator','feature_flags.read'),('operator','admin_roles.read'),('operator','users.manage'),('operator','assets.manage'),('operator','markets.manage'),('viewer','users.read'),('viewer','assets.read'),('viewer','markets.read'),('viewer','fees.read'),('viewer','wallets.read'),('viewer','reports.read'),('viewer','orders.read'),('viewer','trades.read'),('viewer','transfers.read'),('viewer','ledger.read'),('viewer','audit.read'),('viewer','feature_flags.read'),('viewer','admin_roles.read');
--> statement-breakpoint
-- Explicit compatibility assumption: pre-migration non-system ADMIN accounts
-- already hold full administrative authority. Preserve it; never select USER accounts.
-- Review these existing ADMIN accounts before applying in another environment.
INSERT INTO user_admin_roles(user_id,role_key) SELECT id,'super_admin' FROM users WHERE role='ADMIN' AND is_system=false;
