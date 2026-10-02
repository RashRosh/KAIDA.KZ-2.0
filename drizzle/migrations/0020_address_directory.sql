-- Almaty address directory: replaceable OSM snapshots, separate from seller-owned Location data.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE "address_directory_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_url" text NOT NULL,
  "source_timestamp" timestamp with time zone NOT NULL,
  "source_checksum" text NOT NULL,
  "importer_version" text NOT NULL,
  "status" text NOT NULL,
  "entry_count" integer DEFAULT 0 NOT NULL,
  "counts" jsonb NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "failure_message" text,
  CONSTRAINT "address_directory_imports_status_allowed" CHECK ("status" IN ('loading', 'active', 'superseded', 'failed')),
  CONSTRAINT "address_directory_imports_checksum_format" CHECK ("source_checksum" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "address_directory_imports_entry_count_nonnegative" CHECK ("entry_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "address_directory_imports_checksum_uq" ON "address_directory_imports" ("source_checksum");
--> statement-breakpoint
CREATE UNIQUE INDEX "address_directory_imports_one_active_uq" ON "address_directory_imports" ("status") WHERE "status" = 'active';
--> statement-breakpoint
CREATE INDEX "address_directory_imports_status_idx" ON "address_directory_imports" ("status");
--> statement-breakpoint
CREATE TABLE "address_directory_entries" (
  "import_id" uuid NOT NULL REFERENCES "address_directory_imports"("id") ON DELETE CASCADE,
  "source_key" text NOT NULL,
  "kind" text NOT NULL,
  "display_name" text NOT NULL,
  "address_text" text NOT NULL,
  "search_text" text NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  CONSTRAINT "address_directory_entries_pk" PRIMARY KEY ("import_id", "source_key"),
  CONSTRAINT "address_directory_entries_kind_allowed" CHECK ("kind" IN ('address', 'street', 'marketplace', 'retail')),
  CONSTRAINT "address_directory_entries_display_not_blank" CHECK (char_length(btrim("display_name")) >= 1),
  CONSTRAINT "address_directory_entries_address_not_blank" CHECK (char_length(btrim("address_text")) >= 1),
  CONSTRAINT "address_directory_entries_search_not_blank" CHECK (char_length(btrim("search_text")) >= 1),
  CONSTRAINT "address_directory_entries_latitude_range" CHECK ("latitude" BETWEEN -90 AND 90),
  CONSTRAINT "address_directory_entries_longitude_range" CHECK ("longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE INDEX "address_directory_entries_import_id_idx" ON "address_directory_entries" ("import_id");
--> statement-breakpoint
CREATE INDEX "address_directory_entries_kind_idx" ON "address_directory_entries" ("kind");
--> statement-breakpoint
CREATE INDEX "address_directory_entries_search_trgm_idx" ON "address_directory_entries" USING gin ("search_text" gin_trgm_ops);
