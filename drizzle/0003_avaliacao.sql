CREATE TABLE "price_watches" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"mode" text NOT NULL,
	"target_cents" bigint,
	"start_price_cents" bigint,
	"notified_price_cents" bigint,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "rent_eval" jsonb;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "rent_eval_score" smallint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "sale_eval" jsonb;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "sale_eval_score" smallint;--> statement-breakpoint
ALTER TABLE "price_watches" ADD CONSTRAINT "price_watches_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "price_watches_property_mode" ON "price_watches" USING btree ("property_id","mode");--> statement-breakpoint
CREATE INDEX "properties_rent_eval" ON "properties" USING btree ("rent_eval_score");--> statement-breakpoint
CREATE INDEX "properties_sale_eval" ON "properties" USING btree ("sale_eval_score");