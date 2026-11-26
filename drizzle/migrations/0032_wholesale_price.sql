-- wholesale-price (PO 2026-11-24): the optional wholesale line of a card next to its retail price — the price in the
-- retail basis, the minimum batch (N containers) and how many retail units one container holds. Shared by the card like
-- the unit and the pack. Additive: existing rows get NULL in every column (no wholesale), nothing else changes.

ALTER TABLE "offers" ADD COLUMN "wholesale_price_amount" numeric;
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "wholesale_batch_count" integer;
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "wholesale_container" text;
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "wholesale_container_text" text;
--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "wholesale_per_container" numeric;
--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_wholesale_valid" CHECK ((
  "wholesale_price_amount" IS NULL AND "wholesale_batch_count" IS NULL AND "wholesale_container" IS NULL
  AND "wholesale_container_text" IS NULL AND "wholesale_per_container" IS NULL
) OR (
  "wholesale_price_amount" IS NOT NULL AND "wholesale_batch_count" IS NOT NULL AND "wholesale_container" IS NOT NULL
  AND "wholesale_price_amount" > 0 AND "wholesale_price_amount" NOT IN ('NaN'::numeric, 'Infinity'::numeric)
  AND "wholesale_batch_count" BETWEEN 1 AND 9999
  AND "wholesale_container" IN ('box', 'bag', 'carton', 'net', 'package', 'unit', 'other')
  AND ("wholesale_container" = 'other') = ("wholesale_container_text" IS NOT NULL)
  AND ("wholesale_container_text" IS NULL OR ("wholesale_container_text" = btrim("wholesale_container_text") AND char_length("wholesale_container_text") BETWEEN 1 AND 20))
  AND ("wholesale_container" = 'unit') = ("wholesale_per_container" IS NULL)
  AND ("wholesale_per_container" IS NULL OR "wholesale_per_container" > 0)
  AND "price_unit_code" IS NOT NULL
));
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD COLUMN "wholesale_price_amount" numeric;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD COLUMN "wholesale_batch_count" integer;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD COLUMN "wholesale_container" text;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD COLUMN "wholesale_container_text" text;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD COLUMN "wholesale_per_container" numeric;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_wholesale_valid" CHECK ((
  "wholesale_price_amount" IS NULL AND "wholesale_batch_count" IS NULL AND "wholesale_container" IS NULL
  AND "wholesale_container_text" IS NULL AND "wholesale_per_container" IS NULL
) OR (
  "wholesale_price_amount" IS NOT NULL AND "wholesale_batch_count" IS NOT NULL AND "wholesale_container" IS NOT NULL
  AND "wholesale_price_amount" > 0 AND "wholesale_price_amount" NOT IN ('NaN'::numeric, 'Infinity'::numeric)
  AND "wholesale_batch_count" BETWEEN 1 AND 9999
  AND "wholesale_container" IN ('box', 'bag', 'carton', 'net', 'package', 'unit', 'other')
  AND ("wholesale_container" = 'other') = ("wholesale_container_text" IS NOT NULL)
  AND ("wholesale_container_text" IS NULL OR ("wholesale_container_text" = btrim("wholesale_container_text") AND char_length("wholesale_container_text") BETWEEN 1 AND 20))
  AND ("wholesale_container" = 'unit') = ("wholesale_per_container" IS NULL)
  AND ("wholesale_per_container" IS NULL OR "wholesale_per_container" > 0)
  AND "price_unit_code" IS NOT NULL
));
