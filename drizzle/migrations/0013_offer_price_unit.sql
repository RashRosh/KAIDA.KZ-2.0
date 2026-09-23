ALTER TABLE "offers" ADD COLUMN "price_unit_code" text;
ALTER TABLE "offers" ADD COLUMN "price_unit_value" text;
UPDATE "offers" SET
  "price_unit_code" = CASE lower(btrim("price_unit"))
    WHEN 'кг' THEN 'kg'
    WHEN 'шт' THEN 'piece'
    WHEN 'дана' THEN 'piece'
    WHEN 'л' THEN 'liter'
    WHEN 'упак.' THEN 'package'
    WHEN 'қапт.' THEN 'package'
    ELSE 'other'
  END,
  "price_unit_value" = CASE WHEN lower(btrim("price_unit")) IN ('кг', 'шт', 'дана', 'л', 'упак.', 'қапт.') THEN NULL ELSE btrim("price_unit") END
WHERE "price_unit" IS NOT NULL AND btrim("price_unit") <> '';
ALTER TABLE "offers" DROP COLUMN "price_unit";
ALTER TABLE "offers" ADD CONSTRAINT "offers_price_unit_valid" CHECK (
  ("price_unit_code" IS NULL AND "price_unit_value" IS NULL)
  OR ("price_unit_code" IN ('kg', 'piece', 'liter', 'package') AND "price_unit_value" IS NULL)
  OR ("price_unit_code" = 'other' AND "price_unit_value" IS NOT NULL AND "price_unit_value" = btrim("price_unit_value") AND char_length("price_unit_value") >= 1)
);

ALTER TABLE "seller_change_items" ADD COLUMN "price_unit_code" text;
ALTER TABLE "seller_change_items" ADD COLUMN "price_unit_value" text;
UPDATE "seller_change_items" SET
  "price_unit_code" = CASE lower(btrim("price_unit"))
    WHEN 'кг' THEN 'kg'
    WHEN 'шт' THEN 'piece'
    WHEN 'дана' THEN 'piece'
    WHEN 'л' THEN 'liter'
    WHEN 'упак.' THEN 'package'
    WHEN 'қапт.' THEN 'package'
    ELSE 'other'
  END,
  "price_unit_value" = CASE WHEN lower(btrim("price_unit")) IN ('кг', 'шт', 'дана', 'л', 'упак.', 'қапт.') THEN NULL ELSE btrim("price_unit") END
WHERE "price_unit" IS NOT NULL AND btrim("price_unit") <> '';
ALTER TABLE "seller_change_items" DROP CONSTRAINT "seller_change_items_price_shape";
ALTER TABLE "seller_change_items" DROP CONSTRAINT "seller_change_items_price_unit_valid";
ALTER TABLE "seller_change_items" DROP COLUMN "price_unit";
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_price_shape" CHECK ((
  "price_amount" IS NULL
  AND "price_currency" IS NULL
  AND "price_unit_code" IS NULL
) OR (
  "price_amount" IS NOT NULL
  AND "price_currency" = 'KZT'
));
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_price_unit_valid" CHECK (
  ("price_unit_code" IS NULL AND "price_unit_value" IS NULL)
  OR ("price_unit_code" IN ('kg', 'piece', 'liter', 'package') AND "price_unit_value" IS NULL)
  OR ("price_unit_code" = 'other' AND "price_unit_value" IS NOT NULL AND "price_unit_value" = btrim("price_unit_value") AND char_length("price_unit_value") >= 1)
);
