DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM offers
    WHERE price_amount IS NULL
      AND (price_currency IS NOT NULL OR price_unit IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'mandatory offer price migration found partial legacy price tuple';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM offers
    WHERE price_amount IS NOT NULL
      AND price_currency IS DISTINCT FROM 'KZT'
  ) THEN
    RAISE EXCEPTION 'mandatory offer price migration found unsupported legacy currency';
  END IF;
END $$;

UPDATE offers
SET status = 'inactive',
    revision = revision + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'active'
  AND price_amount IS NULL;

ALTER TABLE offers
  ADD CONSTRAINT offers_active_price_required
  CHECK (status <> 'active' OR (price_amount IS NOT NULL AND price_currency = 'KZT'));

ALTER TABLE offers
  ADD CONSTRAINT offers_future_price_required
  CHECK (price_amount IS NOT NULL AND price_currency = 'KZT') NOT VALID;

ALTER TABLE seller_change_items
  ADD CONSTRAINT seller_change_items_future_price_required
  CHECK (price_amount IS NOT NULL AND price_currency = 'KZT') NOT VALID;
