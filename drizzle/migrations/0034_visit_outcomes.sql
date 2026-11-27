-- CJM 24.11 #2 (visit-outcome): extend offer_reports for guest problem signals and PO 24.11 5-reason set;
-- add visit_outcomes and visit_outcome_receipts for both «Всё совпало» and «Есть проблема».

ALTER TABLE "offer_reports" ALTER COLUMN "reporter_user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "offer_reports" ADD COLUMN "anonymous_key_hash" text;
--> statement-breakpoint
ALTER TABLE "offer_reports" ADD CONSTRAINT "offer_reports_actor" CHECK (
  ("reporter_user_id" IS NOT NULL AND "anonymous_key_hash" IS NULL)
  OR ("reporter_user_id" IS NULL AND "anonymous_key_hash" IS NOT NULL AND "anonymous_key_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "offer_reports" DROP CONSTRAINT "offer_reports_reason";
--> statement-breakpoint
ALTER TABLE "offer_reports" ADD CONSTRAINT "offer_reports_reason" CHECK (
  "reason" IN ('out_of_stock', 'price_mismatch', 'photo_mismatch', 'point_closed', 'description_wrong', 'other')
);
--> statement-breakpoint
ALTER TABLE "offer_reports" DROP CONSTRAINT "offer_reports_photo";
--> statement-breakpoint
ALTER TABLE "offer_reports" ADD CONSTRAINT "offer_reports_photo" CHECK (
  "selected_photo_id" IS NULL OR "reason" = 'photo_mismatch'
);
--> statement-breakpoint
CREATE UNIQUE INDEX "offer_reports_anon_card_version_key"
  ON "offer_reports" ("anonymous_key_hash", "card_id", "card_version")
  WHERE "anonymous_key_hash" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "offer_reports_anon_time"
  ON "offer_reports" ("anonymous_key_hash", "created_at")
  WHERE "anonymous_key_hash" IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION preserve_offer_report_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.closed_at IS NOT NULL OR
  ROW(NEW.id,NEW.reporter_user_id,NEW.anonymous_key_hash,NEW.offer_id,NEW.card_id,NEW.card_version,NEW.reason,NEW.buyer_text,NEW.selected_photo_id,NEW.evidence,NEW.created_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.reporter_user_id,OLD.anonymous_key_hash,OLD.offer_id,OLD.card_id,OLD.card_version,OLD.reason,OLD.buyer_text,OLD.selected_photo_id,OLD.evidence,OLD.created_at)
 THEN RAISE EXCEPTION 'Report evidence and historical disposition are immutable'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TABLE "visit_outcomes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "offer_id" uuid NOT NULL REFERENCES "offers"("id") ON DELETE CASCADE,
  "card_id" uuid NOT NULL,
  "location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  "seller_id" uuid NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "card_version" text NOT NULL,
  "outcome" text NOT NULL,
  "reason" text,
  "reporter_user_id" uuid REFERENCES "users"("id"),
  "visitor_key_hash" text NOT NULL,
  "is_verified" boolean NOT NULL,
  "has_visit_signal" boolean NOT NULL DEFAULT false,
  "report_id" uuid REFERENCES "offer_reports"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "visit_outcomes_version" CHECK ("card_version" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "visit_outcomes_visitor_hash" CHECK ("visitor_key_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "visit_outcomes_kind_reason" CHECK (
    ("outcome" = 'matched' AND "reason" IS NULL AND "report_id" IS NULL)
    OR ("outcome" = 'problem' AND "reason" IN ('out_of_stock', 'price_mismatch', 'photo_mismatch', 'point_closed', 'other'))
  ),
  CONSTRAINT "visit_outcomes_verified_actor" CHECK ("is_verified" = ("reporter_user_id" IS NOT NULL)),
  UNIQUE ("visitor_key_hash", "card_id", "card_version")
);
--> statement-breakpoint
CREATE INDEX "visit_outcomes_seller_location_time" ON "visit_outcomes" ("seller_id", "location_id", "created_at");
--> statement-breakpoint
CREATE INDEX "visit_outcomes_visitor_time" ON "visit_outcomes" ("visitor_key_hash", "outcome", "created_at");
--> statement-breakpoint
CREATE TABLE "visit_outcome_receipts" (
  "visitor_key_hash" text NOT NULL,
  "submission_id" uuid NOT NULL,
  "outcome_id" uuid NOT NULL REFERENCES "visit_outcomes"("id") ON DELETE CASCADE,
  "input_digest" text NOT NULL,
  PRIMARY KEY ("visitor_key_hash", "submission_id")
);
