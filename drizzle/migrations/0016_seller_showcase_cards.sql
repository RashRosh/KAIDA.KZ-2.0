-- seller-showcase-editor: Offers get the Seller's own title, a card id grouping the Offers of one product across
-- points, an own-price flag and an optional pack; the catalog link becomes optional. Drafts of new cards are stored
-- per Seller.

ALTER TABLE "offers" ALTER COLUMN "product_id" DROP NOT NULL;
ALTER TABLE "offers" ADD COLUMN "title" text;
ALTER TABLE "offers" ADD COLUMN "title_search" text;
ALTER TABLE "offers" ADD COLUMN "card_id" uuid;
ALTER TABLE "offers" ADD COLUMN "price_own" boolean DEFAULT false NOT NULL;
ALTER TABLE "offers" ADD COLUMN "pack_amount" numeric;
ALTER TABLE "offers" ADD COLUMN "pack_unit" text;
--> statement-breakpoint
-- The backfill touches legacy rows without a price; the NOT VALID future-price rules are re-added unchanged afterwards.
ALTER TABLE "offers" DROP CONSTRAINT "offers_future_price_required";
ALTER TABLE "seller_change_items" DROP CONSTRAINT "seller_change_items_future_price_required";
--> statement-breakpoint
-- Existing Offers: the Russian catalog name becomes the title; each Offer is its own one-point card.
UPDATE "offers" o SET
  "title" = p."name",
  "title_search" = btrim(regexp_replace(lower(translate(p."name", 'Ёё', 'Ее')), '[^0-9a-zа-яәғқңөұүһі]+', ' ', 'g')),
  "card_id" = o."id"
FROM "products" p WHERE p."id" = o."product_id";
--> statement-breakpoint
ALTER TABLE "offers" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "offers" ALTER COLUMN "title_search" SET NOT NULL;
ALTER TABLE "offers" ALTER COLUMN "card_id" SET NOT NULL;
ALTER TABLE "offers" ADD CONSTRAINT "offers_title_valid" CHECK (char_length(btrim("title")) BETWEEN 1 AND 80 AND "title" = btrim("title"));
ALTER TABLE "offers" ADD CONSTRAINT "offers_pack_valid" CHECK (
  ("pack_amount" IS NULL AND "pack_unit" IS NULL)
  OR ("pack_amount" > 0 AND "pack_unit" IN ('g', 'kg', 'ml', 'l') AND "price_unit_code" IN ('package', 'piece'))
);
CREATE INDEX "offers_card_id_idx" ON "offers" ("card_id");
--> statement-breakpoint
ALTER TABLE "seller_change_items" ALTER COLUMN "product_id" DROP NOT NULL;
ALTER TABLE "seller_change_items" ADD COLUMN "title" text;
ALTER TABLE "seller_change_items" ADD COLUMN "card_id" uuid;
ALTER TABLE "seller_change_items" ADD COLUMN "price_own" boolean DEFAULT false NOT NULL;
ALTER TABLE "seller_change_items" ADD COLUMN "pack_amount" numeric;
ALTER TABLE "seller_change_items" ADD COLUMN "pack_unit" text;
--> statement-breakpoint
UPDATE "seller_change_items" i SET "title" = p."name" FROM "products" p WHERE p."id" = i."product_id";
UPDATE "seller_change_items" i SET "card_id" = coalesce(i."result_offer_id", i."target_offer_id", i."id");
--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_future_price_required"
  CHECK ("price_amount" IS NOT NULL AND "price_currency" = 'KZT') NOT VALID;
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_future_price_required"
  CHECK ("price_amount" IS NOT NULL AND "price_currency" = 'KZT') NOT VALID;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "seller_change_items" ALTER COLUMN "card_id" SET NOT NULL;
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_pack_valid" CHECK (
  ("pack_amount" IS NULL AND "pack_unit" IS NULL)
  OR ("pack_amount" > 0 AND "pack_unit" IN ('g', 'kg', 'ml', 'l') AND "price_unit_code" IN ('package', 'piece'))
);
--> statement-breakpoint
CREATE TABLE "offer_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "seller_id" uuid NOT NULL REFERENCES "sellers"("id"),
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "offer_drafts_seller_id_idx" ON "offer_drafts" ("seller_id");
--> statement-breakpoint
-- Publishing a draft removes it in the same confirmation.
ALTER TABLE "seller_change_sets" ADD COLUMN "draft_id" uuid REFERENCES "offer_drafts"("id") ON DELETE SET NULL;
