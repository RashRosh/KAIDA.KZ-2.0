-- offer-actuality: a Seller's reconfirmation («Подтвердить актуальность», «Всё актуально») is a ChangeSet item that
-- only moves last_confirmed_at. Existing rows are not touched.

ALTER TABLE "seller_change_items" DROP CONSTRAINT "seller_change_items_action_allowed";
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_action_allowed" CHECK ("seller_change_items"."action" IN ('create_offer', 'update_offer', 'deactivate_offer', 'activate_offer', 'reconfirm_offer'));
--> statement-breakpoint
ALTER TABLE "seller_change_items" DROP CONSTRAINT "seller_change_items_target_consistent";
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_target_consistent" CHECK ((
  "seller_change_items"."action" = 'create_offer'
  AND "seller_change_items"."target_offer_id" IS NULL
  AND "seller_change_items"."expected_offer_revision" IS NULL
) OR (
  "seller_change_items"."action" IN ('update_offer', 'deactivate_offer', 'activate_offer', 'reconfirm_offer')
  AND "seller_change_items"."target_offer_id" IS NOT NULL
  AND "seller_change_items"."expected_offer_revision" IS NOT NULL
));
