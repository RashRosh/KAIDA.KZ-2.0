CREATE TABLE auth_otp_source_events (
 id uuid PRIMARY KEY,
 source_digest char(64) NOT NULL CHECK (source_digest ~ '^[0-9a-f]{64}$'),
 key_generation char(64) NOT NULL CHECK (key_generation ~ '^[0-9a-f]{64}$'),
 accepted_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX otp_source_digest_time ON auth_otp_source_events(source_digest, accepted_at);
--> statement-breakpoint
CREATE INDEX otp_source_cleanup_time ON auth_otp_source_events(accepted_at);
--> statement-breakpoint
CREATE TABLE auth_otp_source_maintenance (
 id text PRIMARY KEY CHECK (id = 'singleton'),
 key_generation char(64) NOT NULL CHECK (key_generation ~ '^[0-9a-f]{64}$'),
 last_cleanup_at timestamptz,
 quarantine_until timestamptz,
 retention_incident_at timestamptz
);
