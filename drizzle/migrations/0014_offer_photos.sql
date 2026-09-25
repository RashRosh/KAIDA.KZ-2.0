CREATE TABLE "photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "photos_dimensions_positive" CHECK ("width" >= 1 AND "height" >= 1)
);
--> statement-breakpoint
CREATE INDEX "photos_owner_user_id_idx" ON "photos" ("owner_user_id");
--> statement-breakpoint
CREATE TABLE "offer_photos" (
  "offer_id" uuid NOT NULL REFERENCES "offers"("id"),
  "photo_id" uuid NOT NULL REFERENCES "photos"("id"),
  "position" integer NOT NULL,
  CONSTRAINT "offer_photos_offer_id_position_pk" PRIMARY KEY ("offer_id", "position"),
  CONSTRAINT "offer_photos_position_range" CHECK ("position" >= 0 AND "position" < 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "offer_photos_offer_photo_unique" ON "offer_photos" ("offer_id", "photo_id");
--> statement-breakpoint
CREATE INDEX "offer_photos_photo_id_idx" ON "offer_photos" ("photo_id");
--> statement-breakpoint
CREATE TABLE "seller_change_item_photos" (
  "item_id" uuid NOT NULL REFERENCES "seller_change_items"("id"),
  "photo_id" uuid NOT NULL REFERENCES "photos"("id"),
  "position" integer NOT NULL,
  CONSTRAINT "seller_change_item_photos_item_id_position_pk" PRIMARY KEY ("item_id", "position"),
  CONSTRAINT "seller_change_item_photos_position_range" CHECK ("position" >= 0 AND "position" < 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "seller_change_item_photos_item_photo_unique" ON "seller_change_item_photos" ("item_id", "photo_id");
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD COLUMN "photos_specified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_photos_specified_scope" CHECK ("photos_specified" = false OR "action" = 'update_offer');
