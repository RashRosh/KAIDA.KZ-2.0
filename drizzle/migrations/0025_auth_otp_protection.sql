ALTER TABLE "auth_otp_challenges" ADD COLUMN "failed_attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "auth_otp_challenges" ADD CONSTRAINT "auth_otp_challenges_failed_attempts_nonnegative" CHECK ("failed_attempts" >= 0);
--> statement-breakpoint
CREATE INDEX "auth_otp_challenges_phone_created_at" ON "auth_otp_challenges" ("phone_e164", "created_at");
