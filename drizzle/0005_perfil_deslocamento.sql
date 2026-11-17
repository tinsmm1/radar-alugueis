ALTER TABLE "settings" ADD COLUMN "profile" jsonb;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "commute" jsonb;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "commute_minutes" smallint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "commute_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "properties_commute" ON "properties" USING btree ("commute_minutes");--> statement-breakpoint
CREATE TABLE "commute_trips" (
	"property_id" integer NOT NULL,
	"workplace_id" text NOT NULL,
	"direction" text NOT NULL,
	"mode" text NOT NULL,
	"signature" text NOT NULL,
	"minutes" smallint NOT NULL,
	"min_minutes" smallint NOT NULL,
	"max_minutes" smallint NOT NULL,
	"free_flow_minutes" smallint,
	"distance_km" real NOT NULL,
	"method" text NOT NULL,
	"at" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commute_trips_property_id_workplace_id_direction_pk" PRIMARY KEY("property_id","workplace_id","direction")
);--> statement-breakpoint
ALTER TABLE "commute_trips" ADD CONSTRAINT "commute_trips_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
