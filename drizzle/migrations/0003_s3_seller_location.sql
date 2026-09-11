ALTER TABLE "sellers" ADD COLUMN "owner_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "seller_id" uuid;
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "type" text;
--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "sellers_owner_user_id_owned_unique" ON "sellers" USING btree ("owner_user_id") WHERE "sellers"."owner_user_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_display_name_not_blank" CHECK (char_length(btrim("sellers"."display_name")) >= 1);
--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_display_name_max_length" CHECK (char_length(btrim("sellers"."display_name")) <= 120);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "locations" l
    LEFT JOIN "offers" o ON o."location_id" = l."id"
    GROUP BY l."id"
    HAVING COUNT(DISTINCT o."seller_id") <> 1
  ) THEN
    RAISE EXCEPTION 'S3 migration cannot derive exactly one seller for every legacy location';
  END IF;
END
$$;
--> statement-breakpoint
UPDATE "locations" l
SET "seller_id" = ownership."seller_id"
FROM (
  SELECT o."location_id", MIN(o."seller_id"::text)::uuid AS "seller_id"
  FROM "offers" o
  GROUP BY o."location_id"
  HAVING COUNT(DISTINCT o."seller_id") = 1
) ownership
WHERE ownership."location_id" = l."id";
--> statement-breakpoint
UPDATE "locations"
SET "type" = CASE
  WHEN "id" = '30000000-0000-4000-8000-000000000001'::uuid THEN 'pavilion'
  ELSE 'other'
END;
--> statement-breakpoint
ALTER TABLE "locations" ALTER COLUMN "seller_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "locations" ALTER COLUMN "type" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "locations_seller_id_idx" ON "locations" USING btree ("seller_id");
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_name_not_blank" CHECK (char_length(btrim("locations"."name")) >= 1);
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_name_max_length" CHECK (char_length(btrim("locations"."name")) <= 120);
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_address_text_not_blank" CHECK (char_length(btrim("locations"."address_text")) >= 1);
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_address_text_max_length" CHECK (char_length(btrim("locations"."address_text")) <= 500);
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_type_allowed" CHECK ("locations"."type" IN ('market', 'shop', 'pavilion', 'home', 'other'));
