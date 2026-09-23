ALTER TABLE "offers" ADD COLUMN "seller_comment_version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "offers" ADD CONSTRAINT "offers_seller_comment_version_positive" CHECK ("seller_comment_version" >= 1);

CREATE TABLE "offer_comment_translations" (
  "offer_id" uuid NOT NULL REFERENCES "offers"("id") ON DELETE CASCADE,
  "comment_version" integer NOT NULL,
  "target_locale" text NOT NULL,
  "translated_text" text,
  "detected_source_language" text DEFAULT 'unknown' NOT NULL,
  "provenance" text DEFAULT 'machine' NOT NULL,
  "status" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "offer_comment_translations_version_locale_pk" PRIMARY KEY("offer_id", "comment_version", "target_locale"),
  CONSTRAINT "offer_comment_translations_version_positive" CHECK ("comment_version" >= 1),
  CONSTRAINT "offer_comment_translations_target_locale_supported" CHECK ("target_locale" IN ('ru', 'kk')),
  CONSTRAINT "offer_comment_translations_provenance_machine" CHECK ("provenance" = 'machine'),
  CONSTRAINT "offer_comment_translations_status_allowed" CHECK ("status" IN ('pending', 'available', 'same-language', 'failed')),
  CONSTRAINT "offer_comment_translations_text_consistent" CHECK ((
    "status" = 'available' AND "translated_text" IS NOT NULL AND length(btrim("translated_text")) > 0
  ) OR (
    "status" <> 'available' AND "translated_text" IS NULL
  ))
);
