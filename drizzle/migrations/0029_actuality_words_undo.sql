-- actuality-words: the one-tap «Всё актуально» can be undone for a few seconds. A reconfirm_offer item remembers the
-- Offer's previous last_confirmed_at; a new undo_reconfirm_offer item restores it. Existing rows are not touched
-- (the new column is nullable and stays empty on them); original ChangeSets are never edited.

ALTER TABLE "seller_change_items" ADD COLUMN "previous_confirmed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "seller_change_items" DROP CONSTRAINT "seller_change_items_action_allowed";
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_action_allowed" CHECK ("seller_change_items"."action" IN ('create_offer', 'update_offer', 'deactivate_offer', 'activate_offer', 'reconfirm_offer', 'undo_reconfirm_offer'));
--> statement-breakpoint
ALTER TABLE "seller_change_items" DROP CONSTRAINT "seller_change_items_target_consistent";
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_target_consistent" CHECK ((
  "seller_change_items"."action" = 'create_offer'
  AND "seller_change_items"."target_offer_id" IS NULL
  AND "seller_change_items"."expected_offer_revision" IS NULL
) OR (
  "seller_change_items"."action" IN ('update_offer', 'deactivate_offer', 'activate_offer', 'reconfirm_offer', 'undo_reconfirm_offer')
  AND "seller_change_items"."target_offer_id" IS NOT NULL
  AND "seller_change_items"."expected_offer_revision" IS NOT NULL
));
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_previous_confirmed_scope" CHECK ("seller_change_items"."previous_confirmed_at" IS NULL OR "seller_change_items"."action" IN ('reconfirm_offer', 'undo_reconfirm_offer'));
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_undo_restore_time_required" CHECK ("seller_change_items"."action" <> 'undo_reconfirm_offer' OR "seller_change_items"."previous_confirmed_at" IS NOT NULL);
