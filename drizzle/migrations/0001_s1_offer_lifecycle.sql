ALTER TABLE "offers" ADD COLUMN "status" text;
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "last_confirmed_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "offers"
SET "status" = 'active',
    "last_confirmed_at" = CURRENT_TIMESTAMP;
--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_status_allowed" CHECK ("offers"."status" IN ('active', 'inactive'));
--> statement-breakpoint
ALTER TABLE "offers" ALTER COLUMN "status" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "offers" ALTER COLUMN "last_confirmed_at" SET NOT NULL;
