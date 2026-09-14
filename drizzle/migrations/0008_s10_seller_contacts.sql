ALTER TABLE "sellers" ADD COLUMN "contact_phone_e164" text;
--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "whatsapp_phone_e164" text;
--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "telegram_username" text;
--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "instagram_username" text;
--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_contact_phone_e164_format" CHECK ("sellers"."contact_phone_e164" IS NULL OR "sellers"."contact_phone_e164" ~ '^\+[1-9][0-9]{1,14}$');
--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_whatsapp_phone_e164_format" CHECK ("sellers"."whatsapp_phone_e164" IS NULL OR "sellers"."whatsapp_phone_e164" ~ '^\+[1-9][0-9]{1,14}$');
--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_telegram_username_format" CHECK ("sellers"."telegram_username" IS NULL OR "sellers"."telegram_username" ~ '^[a-z0-9_]{1,64}$');
--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_instagram_username_format" CHECK ("sellers"."instagram_username" IS NULL OR "sellers"."instagram_username" ~ '^[a-z0-9._]{1,64}$');
