ALTER TABLE "locations" ADD COLUMN "latitude" double precision;
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "longitude" double precision;
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_geo_complete_pair" CHECK (("locations"."latitude" IS NULL AND "locations"."longitude" IS NULL) OR ("locations"."latitude" IS NOT NULL AND "locations"."longitude" IS NOT NULL));
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_latitude_range" CHECK ("locations"."latitude" IS NULL OR "locations"."latitude" BETWEEN -90 AND 90);
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_longitude_range" CHECK ("locations"."longitude" IS NULL OR "locations"."longitude" BETWEEN -180 AND 180);
