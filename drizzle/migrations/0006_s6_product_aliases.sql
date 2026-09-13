CREATE TABLE "product_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "name" text NOT NULL,
  CONSTRAINT "product_aliases_name_not_empty" CHECK (length(btrim("product_aliases"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "product_aliases_name_product_normalized_unique" ON "product_aliases" USING btree ((normalize(casefold(normalize(btrim("name"), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast), "product_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "products_name_normalized_unique" ON "products" USING btree ((normalize(casefold(normalize(btrim("name"), NFC) COLLATE pg_catalog.pg_unicode_fast), NFC) COLLATE pg_catalog.pg_unicode_fast));
