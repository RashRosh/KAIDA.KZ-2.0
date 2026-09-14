CREATE TABLE "buyer_interests" (
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	CONSTRAINT "buyer_interests_user_product_pk" PRIMARY KEY("user_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "buyer_interests" ADD CONSTRAINT "buyer_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "buyer_interests" ADD CONSTRAINT "buyer_interests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
