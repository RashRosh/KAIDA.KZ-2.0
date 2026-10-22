-- seller-ai-text-real-parser §17 (PO 2026-10-21): an optional Telegram username per trading point. Only the
-- normalized username is stored; KAIDA builds the t.me link. Additive: existing rows get NULL, nothing else changes.
-- The legacy seller-level sellers.telegram_username (S10) is untouched; it is only offered for reuse.

ALTER TABLE "locations" ADD COLUMN "telegram_username" text;
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_telegram_username_format" CHECK ("telegram_username" IS NULL OR "telegram_username" ~ '^[a-z][a-z0-9_]{3,30}[a-z0-9]$');
