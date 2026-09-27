-- operator-post-check: an operator removes a whole card from the showcase (service log of removals, returns and
-- republishes) and keeps a per-operator «seen until» mark of the post-check feed. Existing rows are not touched.

CREATE TABLE "offer_card_removals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "card_id" uuid NOT NULL,
  "seller_id" uuid NOT NULL REFERENCES "sellers"("id"),
  "reason" text NOT NULL,
  "comment" text,
  "removed_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "removed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "restored_at" timestamp with time zone,
  "restored_by_user_id" uuid REFERENCES "users"("id"),
  "cleared_at" timestamp with time zone,
  "cleared_by_change_set_id" uuid REFERENCES "seller_change_sets"("id"),
  CONSTRAINT "offer_card_removals_reason_allowed" CHECK ("reason" IN ('prohibited_item', 'photo_mismatch', 'contacts_or_ads', 'other')),
  CONSTRAINT "offer_card_removals_comment_valid" CHECK ("comment" IS NULL OR (
    char_length("comment") BETWEEN 1 AND 300 AND "comment" = btrim("comment")
  )),
  CONSTRAINT "offer_card_removals_restore_consistent" CHECK (("restored_at" IS NULL) = ("restored_by_user_id" IS NULL)),
  CONSTRAINT "offer_card_removals_clear_consistent" CHECK (("cleared_at" IS NULL) = ("cleared_by_change_set_id" IS NULL)),
  CONSTRAINT "offer_card_removals_single_end" CHECK ("restored_at" IS NULL OR "cleared_at" IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "offer_card_removals_active_card_uq" ON "offer_card_removals" ("card_id") WHERE "restored_at" IS NULL AND "cleared_at" IS NULL;
CREATE INDEX "offer_card_removals_seller_id_idx" ON "offer_card_removals" ("seller_id");
--> statement-breakpoint
CREATE TABLE "operator_feed_marks" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id"),
  "seen_until" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
