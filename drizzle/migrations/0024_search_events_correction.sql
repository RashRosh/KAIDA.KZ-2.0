-- search-typo-suggestions: a search event whose original text was automatically corrected keeps the ORIGINAL outcome in the
-- existing columns (unresolved, 0 Offers) and adds the corrected text and its Offer count. Both nullable and set together;
-- existing rows and the allowed `entry` values are not touched. No identifier, no raw spelling, no geolocation.

ALTER TABLE "search_events" ADD COLUMN "corrected_query_normalized" text;
--> statement-breakpoint
ALTER TABLE "search_events" ADD COLUMN "corrected_result_count" integer;
--> statement-breakpoint
ALTER TABLE "search_events" ADD CONSTRAINT "search_events_correction_check" CHECK (
  ("corrected_query_normalized" IS NULL AND "corrected_result_count" IS NULL)
  OR (
    "corrected_query_normalized" IS NOT NULL
    AND "corrected_result_count" IS NOT NULL
    AND "corrected_result_count" >= 1
    AND length("corrected_query_normalized") BETWEEN 1 AND 100
    AND "corrected_query_normalized" <> "query_normalized"
  )
);
