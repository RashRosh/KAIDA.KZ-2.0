ALTER TABLE "locations" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "phone_e164" text;
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "whatsapp_phone_e164" text;
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "opening_hours" jsonb DEFAULT '{"timeZone":"Asia/Almaty","days":{"mon":{"kind":"intervals","intervals":[{"open":"09:00","close":"18:00"}]},"tue":{"kind":"intervals","intervals":[{"open":"09:00","close":"18:00"}]},"wed":{"kind":"intervals","intervals":[{"open":"09:00","close":"18:00"}]},"thu":{"kind":"intervals","intervals":[{"open":"09:00","close":"18:00"}]},"fri":{"kind":"intervals","intervals":[{"open":"09:00","close":"18:00"}]},"sat":{"kind":"closed"},"sun":{"kind":"closed"}}}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "opening_hours_needs_review" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE "locations" AS l SET
  "phone_e164" = s."contact_phone_e164",
  "whatsapp_phone_e164" = s."whatsapp_phone_e164"
FROM "sellers" AS s
WHERE s."id" = l."seller_id";
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_phone_e164_format" CHECK ("phone_e164" IS NULL OR "phone_e164" ~ '^\+[1-9][0-9]{1,14}$');
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_whatsapp_phone_e164_format" CHECK ("whatsapp_phone_e164" IS NULL OR "whatsapp_phone_e164" ~ '^\+[1-9][0-9]{1,14}$');
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_opening_hours_object" CHECK (jsonb_typeof("opening_hours") = 'object');
--> statement-breakpoint
CREATE TABLE "seller_verified_phones" (
  "seller_id" uuid NOT NULL REFERENCES "sellers"("id"),
  "phone_e164" text NOT NULL,
  "verified_at" timestamp with time zone NOT NULL,
  CONSTRAINT "seller_verified_phones_seller_id_phone_e164_pk" PRIMARY KEY ("seller_id", "phone_e164"),
  CONSTRAINT "seller_verified_phones_phone_e164_format" CHECK ("phone_e164" ~ '^\+[1-9][0-9]{1,14}$')
);
--> statement-breakpoint
CREATE TABLE "contact_verification_challenges" (
  "id" uuid PRIMARY KEY NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "phone_e164" text NOT NULL,
  "otp_digest" char(64) NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "superseded_at" timestamp with time zone,
  CONSTRAINT "contact_verification_challenges_phone_e164_format" CHECK ("phone_e164" ~ '^\+[1-9][0-9]{1,14}$'),
  CONSTRAINT "contact_verification_challenges_digest_format" CHECK ("otp_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "contact_verification_challenges_expiry_after_creation" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "contact_verification_challenges_single_terminal_state" CHECK (NOT ("consumed_at" IS NOT NULL AND "superseded_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "contact_verification_challenges_one_unfinished" ON "contact_verification_challenges" ("owner_user_id", "phone_e164") WHERE "consumed_at" IS NULL AND "superseded_at" IS NULL;
