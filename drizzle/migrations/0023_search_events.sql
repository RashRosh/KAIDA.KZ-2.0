-- S15C / D0: intentional buyer searches as search events (not people). No user id, session/device key, IP, user agent,
-- locale, raw spelling or geolocation; time is truncated to the hour by the writer. Existing rows are not touched.

CREATE TABLE "search_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "entry" text NOT NULL,
  "query_normalized" text NOT NULL,
  "resolved_product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "resolution" text NOT NULL,
  "result_count" integer NOT NULL,
  "origin" text NOT NULL,
  CONSTRAINT "search_events_entry_check" CHECK ("entry" IN ('submit','suggestion','chip')),
  CONSTRAINT "search_events_resolution_check" CHECK ("resolution" IN ('selected','resolved','ambiguous','unresolved')),
  CONSTRAINT "search_events_origin_check" CHECK ("origin" IN ('organic','dev','test','synthetic')),
  CONSTRAINT "search_events_query_check" CHECK (length("query_normalized") BETWEEN 1 AND 100),
  CONSTRAINT "search_events_result_count_check" CHECK ("result_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "search_events_origin_occurred_at_idx" ON "search_events" ("origin", "occurred_at");
