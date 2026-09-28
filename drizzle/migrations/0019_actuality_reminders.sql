-- actuality-reminders: device push subscriptions per login and the log of sent actuality reminders (one per point,
-- moment and confirmation cycle). Existing rows are not touched.

CREATE TABLE "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE ("endpoint")
);
--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" ("user_id");
--> statement-breakpoint
CREATE TABLE "actuality_reminders_sent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "seller_id" uuid NOT NULL REFERENCES "sellers"("id"),
  "offer_id" uuid NOT NULL REFERENCES "offers"("id"),
  "moment_hours" integer NOT NULL,
  "confirmed_at" timestamp with time zone NOT NULL,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "actuality_reminders_sent_moment_positive" CHECK ("moment_hours" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "actuality_reminders_sent_cycle_uq" ON "actuality_reminders_sent" ("offer_id", "moment_hours", "confirmed_at");
