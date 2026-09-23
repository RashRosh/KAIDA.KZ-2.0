ALTER TABLE "product_aliases" ADD COLUMN "locale" text;
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_locale_supported"
  CHECK ("locale" IS NULL OR "locale" IN ('ru', 'kk'));

CREATE TABLE "product_localized_names" (
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "locale" text NOT NULL,
  "name" text NOT NULL,
  "verified_at" timestamp with time zone,
  CONSTRAINT "product_localized_names_product_locale_pk" PRIMARY KEY("product_id", "locale"),
  CONSTRAINT "product_localized_names_locale_supported" CHECK ("locale" IN ('ru', 'kk')),
  CONSTRAINT "product_localized_names_name_not_empty" CHECK (length(btrim("name")) > 0)
);

CREATE UNIQUE INDEX "product_localized_names_locale_name_normalized_unique"
  ON "product_localized_names" USING btree (
    "locale",
    normalize(casefold(normalize(btrim("name"), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast
  );

INSERT INTO "product_localized_names" ("product_id", "locale", "name")
SELECT "id", 'ru', "name" FROM "products";
