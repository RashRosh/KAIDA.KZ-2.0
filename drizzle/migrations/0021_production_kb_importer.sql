ALTER TABLE "products" ADD COLUMN "kb_product_id" text;
ALTER TABLE "product_aliases" ADD COLUMN "kb_alias_id" text;

CREATE TABLE "product_categories" (
  "code" text PRIMARY KEY,
  "label_ru" text NOT NULL,
  "label_kk" text NOT NULL
);

CREATE TABLE "product_category_links" (
  "product_id" uuid PRIMARY KEY REFERENCES "products"("id"),
  "category_code" text NOT NULL REFERENCES "product_categories"("code")
);

CREATE TABLE "kb_package_install" (
  "id" boolean PRIMARY KEY DEFAULT true,
  "package_name" text NOT NULL,
  "package_version" text NOT NULL,
  "package_schema_version" integer NOT NULL,
  "source_checkpoint_tag" text NOT NULL,
  "source_commit_sha" text NOT NULL,
  "manifest_sha256" text NOT NULL,
  "products_count" integer NOT NULL,
  "aliases_count" integer NOT NULL,
  "categories_count" integer NOT NULL,
  "installed_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "kb_package_install_singleton" CHECK ("id" = true),
  CONSTRAINT "kb_package_install_schema_positive" CHECK ("package_schema_version" > 0),
  CONSTRAINT "kb_package_install_counts_non_negative" CHECK ("products_count" >= 0 AND "aliases_count" >= 0 AND "categories_count" >= 0),
  CONSTRAINT "kb_package_install_source_commit_sha_format" CHECK ("source_commit_sha" ~ '^[0-9a-f]{40}$'),
  CONSTRAINT "kb_package_install_manifest_sha256_format" CHECK ("manifest_sha256" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "products_kb_product_id_unique" ON "products" ("kb_product_id") WHERE "kb_product_id" IS NOT NULL;
CREATE UNIQUE INDEX "product_aliases_kb_alias_id_unique" ON "product_aliases" ("kb_alias_id") WHERE "kb_alias_id" IS NOT NULL;

ALTER TABLE "products" ADD CONSTRAINT "products_kb_product_id_format" CHECK ("kb_product_id" IS NULL OR "kb_product_id" ~ '^KAIDA-P[0-9]{4}$');
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_kb_alias_id_format" CHECK ("kb_alias_id" IS NULL OR "kb_alias_id" ~ '^A-[0-9]{5}$');
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_code_format" CHECK ("code" ~ '^[A-Z0-9_]+$');
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_label_ru_not_empty" CHECK (length(btrim("label_ru")) > 0);
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_label_kk_not_empty" CHECK (length(btrim("label_kk")) > 0);
