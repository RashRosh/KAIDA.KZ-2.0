CREATE TABLE "users" (
  "id" uuid PRIMARY KEY NOT NULL,
  "phone_e164" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CONSTRAINT "users_phone_e164_unique" UNIQUE("phone_e164"),
  CONSTRAINT "users_phone_e164_format" CHECK ("users"."phone_e164" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "auth_otp_challenges" (
  "id" uuid PRIMARY KEY NOT NULL,
  "phone_e164" text NOT NULL,
  "otp_digest" char(64) NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "superseded_at" timestamp with time zone,
  CONSTRAINT "auth_otp_challenges_phone_e164_format" CHECK ("auth_otp_challenges"."phone_e164" ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT "auth_otp_challenges_digest_format" CHECK ("auth_otp_challenges"."otp_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "auth_otp_challenges_expiry_after_creation" CHECK ("auth_otp_challenges"."expires_at" > "auth_otp_challenges"."created_at"),
  CONSTRAINT "auth_otp_challenges_single_terminal_state" CHECK (NOT ("auth_otp_challenges"."consumed_at" IS NOT NULL AND "auth_otp_challenges"."superseded_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_otp_challenges_one_unfinished_per_phone" ON "auth_otp_challenges" USING btree ("phone_e164") WHERE "auth_otp_challenges"."consumed_at" IS NULL AND "auth_otp_challenges"."superseded_at" IS NULL;
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "token_digest" char(64) NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "auth_sessions_token_digest_unique" UNIQUE("token_digest"),
  CONSTRAINT "auth_sessions_digest_format" CHECK ("auth_sessions"."token_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "auth_sessions_expiry_after_creation" CHECK ("auth_sessions"."expires_at" > "auth_sessions"."created_at")
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
