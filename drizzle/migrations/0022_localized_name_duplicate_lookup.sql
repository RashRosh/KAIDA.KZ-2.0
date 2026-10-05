DROP INDEX IF EXISTS "product_localized_names_locale_name_normalized_unique";

CREATE INDEX "product_localized_names_locale_name_normalized_lookup"
  ON "product_localized_names" USING btree (
    "locale",
    normalize(casefold(normalize(btrim("name"), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast
  );
