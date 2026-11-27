-- wholesale-only (PO 2026-11-26): allow cards sold wholesale-only (price_amount IS NULL, wholesale_price_amount IS NOT NULL).
-- For wholesale-only rows, price_unit_code stays required (free unit for wholesale price) and wholesale_per_container becomes
-- optional for non-unit containers; mixed retail+wholesale rows still require wholesale_per_container for non-unit containers.
-- offers_future_price_required and seller_change_items_future_price_required stay NOT VALID so historical pre-0010 rows
-- continue to upgrade cleanly while every new/updated row must have either retail price (KZT) or wholesale price.

ALTER TABLE "offers" DROP CONSTRAINT "offers_active_price_required";
--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_active_price_required" CHECK (
  "status" <> 'active'
  OR ("price_amount" IS NOT NULL AND "price_currency" = 'KZT')
  OR "wholesale_price_amount" IS NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offers" DROP CONSTRAINT "offers_future_price_required";
--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_future_price_required" CHECK (
  ("price_amount" IS NOT NULL AND "price_currency" = 'KZT')
  OR "wholesale_price_amount" IS NOT NULL
) NOT VALID;
--> statement-breakpoint
ALTER TABLE "offers" DROP CONSTRAINT "offers_wholesale_valid";
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
  AND (
    ("wholesale_container" = 'unit' AND "wholesale_per_container" IS NULL)
    OR ("wholesale_container" <> 'unit' AND ("wholesale_per_container" IS NOT NULL OR "price_amount" IS NULL))
  )
  AND ("wholesale_per_container" IS NULL OR ("wholesale_per_container" > 0 AND "wholesale_per_container" NOT IN ('NaN'::numeric, 'Infinity'::numeric)))
  AND "price_unit_code" IS NOT NULL
));
--> statement-breakpoint
ALTER TABLE "seller_change_items" DROP CONSTRAINT "seller_change_items_price_shape";
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_price_shape" CHECK ((
  "price_amount" IS NULL
  AND "price_currency" IS NULL
  AND ("price_unit_code" IS NULL OR "wholesale_price_amount" IS NOT NULL)
) OR (
  "price_amount" IS NOT NULL
  AND "price_currency" = 'KZT'
));
--> statement-breakpoint
ALTER TABLE "seller_change_items" DROP CONSTRAINT "seller_change_items_future_price_required";
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_future_price_required" CHECK (
  ("price_amount" IS NOT NULL AND "price_currency" = 'KZT')
  OR "wholesale_price_amount" IS NOT NULL
) NOT VALID;
--> statement-breakpoint
ALTER TABLE "seller_change_items" DROP CONSTRAINT "seller_change_items_wholesale_valid";
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
  AND (
    ("wholesale_container" = 'unit' AND "wholesale_per_container" IS NULL)
    OR ("wholesale_container" <> 'unit' AND ("wholesale_per_container" IS NOT NULL OR "price_amount" IS NULL))
  )
  AND ("wholesale_per_container" IS NULL OR ("wholesale_per_container" > 0 AND "wholesale_per_container" NOT IN ('NaN'::numeric, 'Infinity'::numeric)))
  AND "price_unit_code" IS NOT NULL
));
