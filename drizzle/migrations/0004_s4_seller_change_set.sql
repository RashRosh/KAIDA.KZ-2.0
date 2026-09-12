CREATE TABLE "seller_change_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "seller_change_sets_status_allowed" CHECK ("seller_change_sets"."status" IN ('proposed', 'confirmed')),
	CONSTRAINT "seller_change_sets_confirmation_consistent" CHECK ((
    "seller_change_sets"."status" = 'proposed' AND "seller_change_sets"."confirmed_at" IS NULL
  ) OR (
    "seller_change_sets"."status" = 'confirmed' AND "seller_change_sets"."confirmed_at" IS NOT NULL
  ))
);
--> statement-breakpoint
CREATE TABLE "seller_change_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"change_set_id" uuid NOT NULL,
	"action" text NOT NULL,
	"product_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"price_amount" numeric,
	"price_currency" char(3),
	"price_unit" text,
	"seller_comment" text,
	"result_offer_id" uuid,
	CONSTRAINT "seller_change_items_action_allowed" CHECK ("seller_change_items"."action" = 'create_offer'),
	CONSTRAINT "seller_change_items_price_valid" CHECK ("seller_change_items"."price_amount" IS NULL OR (
    "seller_change_items"."price_amount" >= 0
    AND "seller_change_items"."price_amount" NOT IN ('NaN'::numeric, 'Infinity'::numeric)
    AND scale("seller_change_items"."price_amount") <= 2
    AND "seller_change_items"."price_amount" < 1000000000000
  )),
	CONSTRAINT "seller_change_items_price_shape" CHECK ((
    "seller_change_items"."price_amount" IS NULL
    AND "seller_change_items"."price_currency" IS NULL
    AND "seller_change_items"."price_unit" IS NULL
  ) OR (
    "seller_change_items"."price_amount" IS NOT NULL
    AND "seller_change_items"."price_currency" = 'KZT'
  )),
	CONSTRAINT "seller_change_items_price_unit_valid" CHECK ("seller_change_items"."price_unit" IS NULL OR (
    char_length(btrim("seller_change_items"."price_unit")) >= 1
    AND char_length(btrim("seller_change_items"."price_unit")) <= 32
  )),
	CONSTRAINT "seller_change_items_seller_comment_valid" CHECK ("seller_change_items"."seller_comment" IS NULL OR (
    char_length(btrim("seller_change_items"."seller_comment")) >= 1
    AND char_length(btrim("seller_change_items"."seller_comment")) <= 500
  ))
);
--> statement-breakpoint
ALTER TABLE "seller_change_sets" ADD CONSTRAINT "seller_change_sets_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_change_set_id_seller_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."seller_change_sets"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "seller_change_items" ADD CONSTRAINT "seller_change_items_result_offer_id_offers_id_fk" FOREIGN KEY ("result_offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "seller_change_items_change_set_id_idx" ON "seller_change_items" USING btree ("change_set_id");
