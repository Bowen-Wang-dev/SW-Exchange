ALTER TABLE "assets" ADD COLUMN "display_name" varchar(128);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "icon_url" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "icon_source" varchar(32);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "sort_order" integer;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "description" text;--> statement-breakpoint
UPDATE "assets"
SET
  "display_name" = COALESCE("display_name", "name"),
  "icon_source" = COALESCE("icon_source", 'FALLBACK'),
  "sort_order" = COALESCE("sort_order", CASE "symbol" WHEN 'SWC' THEN 10 WHEN 'SWL' THEN 20 ELSE NULL END),
  "description" = COALESCE(
    "description",
    CASE "symbol"
      WHEN 'SWC' THEN 'Simulated settlement unit referencing HKD display only, not redeemable.'
      WHEN 'SWL' THEN 'Virtual volatile token for simulation.'
      ELSE NULL
    END
  ),
  "updated_at" = now()
WHERE "symbol" IN ('SWC', 'SWL');
