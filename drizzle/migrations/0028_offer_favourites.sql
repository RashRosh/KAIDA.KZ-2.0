CREATE TABLE buyer_offer_favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL,
  location_id uuid NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_offer_favourites_identity UNIQUE(user_id, offer_id, location_id)
);
--> statement-breakpoint
CREATE INDEX buyer_offer_favourites_owner_order ON buyer_offer_favourites(user_id, saved_at DESC, id DESC);
