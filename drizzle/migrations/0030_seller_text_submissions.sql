-- seller-ai-text-real-parser §6.4: durable retry protection for seller text input. One row per (Seller, requestId)
-- for 24 hours: a salted SHA-256 digest of the text (the text itself is never stored), the processing outcome and,
-- on success, the IDs of the drafts it created plus what the Seller was told. Additive; no existing table changes.

CREATE TABLE "seller_text_submissions" (
  "seller_id" uuid NOT NULL REFERENCES "sellers"("id") ON DELETE CASCADE,
  "request_id" uuid NOT NULL,
  "text_digest" char(64) NOT NULL,
  "parser" text NOT NULL,
  "status" text NOT NULL,
  "attempt_id" uuid NOT NULL,
  "attempt_started_at" timestamp with time zone NOT NULL,
  "failure_code" text,
  "result" jsonb,
  "created_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "seller_text_submissions_pkey" PRIMARY KEY ("seller_id", "request_id"),
  CONSTRAINT "seller_text_submissions_status_allowed" CHECK ("status" IN ('processing', 'succeeded', 'failed')),
  CONSTRAINT "seller_text_submissions_parser_allowed" CHECK ("parser" IN ('fake', 'real')),
  CONSTRAINT "seller_text_submissions_digest_format" CHECK ("text_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "seller_text_submissions_outcome_consistent" CHECK ((
    "status" = 'succeeded' AND "result" IS NOT NULL AND "completed_at" IS NOT NULL AND "failure_code" IS NULL
  ) OR (
    "status" = 'failed' AND "result" IS NULL AND "failure_code" IS NOT NULL
  ) OR (
    "status" = 'processing' AND "result" IS NULL AND "failure_code" IS NULL
  )),
  CONSTRAINT "seller_text_submissions_expiry_after_creation" CHECK ("expires_at" > "created_at")
);
--> statement-breakpoint
CREATE INDEX "seller_text_submissions_expiry" ON "seller_text_submissions" ("expires_at");
