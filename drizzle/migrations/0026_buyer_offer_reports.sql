CREATE TABLE offer_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reporter_user_id uuid NOT NULL REFERENCES users(id),
 offer_id uuid NOT NULL REFERENCES offers(id), card_id uuid NOT NULL,
 card_version text NOT NULL, reason text NOT NULL, buyer_text text NOT NULL DEFAULT '',
 selected_photo_id uuid REFERENCES photos(id), evidence jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz, closed_by_user_id uuid REFERENCES users(id),
 disposition text, rationale text, moderation_id uuid REFERENCES offer_card_removals(id), decision_digest text,
 CONSTRAINT offer_reports_reason CHECK(reason IN ('price_mismatch','photo_mismatch','description_wrong','other')),
 CONSTRAINT offer_reports_text CHECK(char_length(buyer_text)<=300 AND buyer_text=btrim(buyer_text)),
 CONSTRAINT offer_reports_photo CHECK((reason='photo_mismatch')=(selected_photo_id IS NOT NULL)),
 CONSTRAINT offer_reports_version CHECK(card_version ~ '^[a-f0-9]{64}$'),
 CONSTRAINT offer_reports_closure CHECK(
  (closed_at IS NULL AND closed_by_user_id IS NULL AND disposition IS NULL AND rationale IS NULL AND moderation_id IS NULL AND decision_digest IS NULL)
  OR (closed_at IS NOT NULL AND closed_by_user_id IS NOT NULL AND decision_digest IS NOT NULL AND disposition IS NOT NULL
   AND disposition IN ('removed','already_removed','returned','no_action')
   AND (disposition='no_action' OR moderation_id IS NOT NULL)
   AND (disposition NOT IN ('returned','no_action') OR (rationale IS NOT NULL AND char_length(btrim(rationale)) BETWEEN 1 AND 300)))),
 UNIQUE(reporter_user_id,card_id,card_version)
);
--> statement-breakpoint
CREATE INDEX offer_reports_user_time ON offer_reports(reporter_user_id,created_at);
CREATE INDEX offer_reports_queue ON offer_reports(closed_at,created_at,id);
--> statement-breakpoint
CREATE TABLE offer_report_photos (
 report_id uuid NOT NULL REFERENCES offer_reports(id) ON DELETE CASCADE,
 photo_id uuid NOT NULL REFERENCES photos(id), PRIMARY KEY(report_id,photo_id)
);
--> statement-breakpoint
CREATE TABLE offer_report_receipts (
 user_id uuid NOT NULL REFERENCES users(id), submission_id uuid NOT NULL,
 report_id uuid NOT NULL REFERENCES offer_reports(id) ON DELETE CASCADE,
 input_digest text NOT NULL, PRIMARY KEY(user_id,submission_id)
);
--> statement-breakpoint
CREATE FUNCTION preserve_offer_report_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.closed_at IS NOT NULL OR
  ROW(NEW.id,NEW.reporter_user_id,NEW.offer_id,NEW.card_id,NEW.card_version,NEW.reason,NEW.buyer_text,NEW.selected_photo_id,NEW.evidence,NEW.created_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.reporter_user_id,OLD.offer_id,OLD.card_id,OLD.card_version,OLD.reason,OLD.buyer_text,OLD.selected_photo_id,OLD.evidence,OLD.created_at)
 THEN RAISE EXCEPTION 'Report evidence and historical disposition are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER offer_reports_immutable BEFORE UPDATE ON offer_reports FOR EACH ROW EXECUTE FUNCTION preserve_offer_report_evidence();
