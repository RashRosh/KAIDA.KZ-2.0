ALTER TABLE "offers" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD COLUMN "target_offer_id" uuid;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD COLUMN "expected_offer_revision" integer;
--> statement-breakpoint
ALTER TABLE "seller_change_items" DROP CONSTRAINT "seller_change_items_action_allowed";
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_action_allowed" CHECK ("seller_change_items"."action" IN ('create_offer', 'update_offer', 'deactivate_offer', 'activate_offer'));
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_expected_offer_revision_valid" CHECK ("seller_change_items"."expected_offer_revision" IS NULL OR "seller_change_items"."expected_offer_revision" >= 1);
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_target_consistent" CHECK ((
  "seller_change_items"."action" = 'create_offer'
  AND "seller_change_items"."target_offer_id" IS NULL
  AND "seller_change_items"."expected_offer_revision" IS NULL
) OR (
  "seller_change_items"."action" IN ('update_offer', 'deactivate_offer', 'activate_offer')
  AND "seller_change_items"."target_offer_id" IS NOT NULL
  AND "seller_change_items"."expected_offer_revision" IS NOT NULL
));
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_target_offer_id_offers_id_fk" FOREIGN KEY ("target_offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;
