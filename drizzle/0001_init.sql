CREATE TABLE "collection_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"stage" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"stats" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"external_id" text NOT NULL,
	"property_id" integer,
	"raw_id" bigint,
	"url" text,
	"title" text,
	"description" text,
	"type" text,
	"rent_cents" integer,
	"condo_cents" integer,
	"iptu_cents" integer,
	"iptu_period" text,
	"other_fees_cents" integer,
	"fees_note" text,
	"area_m2" real,
	"bedrooms" smallint,
	"suites" smallint,
	"bathrooms" smallint,
	"parking" smallint,
	"features" text[] DEFAULT '{}'::text[] NOT NULL,
	"advertiser_type" text,
	"advertiser_name" text,
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"street" text,
	"number" text,
	"neighborhood" text,
	"city" text,
	"postal_code" text,
	"lat" double precision,
	"lng" double precision,
	"address_hidden" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"missing_count" smallint DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"price_changed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listings_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"external_id" text NOT NULL,
	"hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "possible_duplicates" (
	"a" integer NOT NULL,
	"b" integer NOT NULL,
	"score" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"property_id" integer,
	"rent_cents" integer,
	"condo_cents" integer,
	"iptu_cents" integer,
	"total_cents" integer,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text,
	"type" text,
	"neighborhood" text,
	"neighborhood_key" text,
	"regional" text,
	"street" text,
	"number" text,
	"geom" geometry(Point,4326),
	"lat" double precision,
	"lng" double precision,
	"geo_precision" text,
	"geo_source" text,
	"geo_tried_at" timestamp with time zone,
	"area_m2" real,
	"bedrooms" smallint,
	"suites" smallint,
	"bathrooms" smallint,
	"parking" smallint,
	"features" text[] DEFAULT '{}'::text[] NOT NULL,
	"photo" text,
	"rent_cents" integer,
	"condo_cents" integer,
	"iptu_monthly_cents" integer,
	"total_cents" integer,
	"cost_status" text,
	"cost_per_m2_cents" integer,
	"initial_rent_cents" integer,
	"drop_bp" integer,
	"dropped_at" timestamp with time zone,
	"listing_count" smallint DEFAULT 0 NOT NULL,
	"advertiser_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"analysis" jsonb,
	"analyzed_at" timestamp with time zone,
	"risk_score" smallint,
	"risk_level" text,
	"flood_level" smallint,
	"opportunity" jsonb,
	"opportunity_score" smallint DEFAULT 0 NOT NULL,
	"search" text
);
--> statement-breakpoint
CREATE TABLE "source_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer,
	"source_id" integer NOT NULL,
	"status" text NOT NULL,
	"attempt" smallint DEFAULT 1 NOT NULL,
	"fetched" integer DEFAULT 0 NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"price_changes" integer DEFAULT 0 NOT NULL,
	"duplicates" integer DEFAULT 0 NOT NULL,
	"missing" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"adapter" text NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"status" text DEFAULT 'ativa' NOT NULL,
	"authorization" text,
	"assessment" jsonb,
	"is_demo" boolean DEFAULT false NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_ok_at" timestamp with time zone,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"regional" text,
	"geom" geometry(Geometry,4326) NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geolocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"address_key" text NOT NULL,
	"query" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"precision" text,
	"provider" text DEFAULT 'nominatim' NOT NULL,
	"display_name" text,
	"neighborhood" text,
	"regional" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "geolocations_address_key_unique" UNIQUE("address_key")
);
--> statement-breakpoint
CREATE TABLE "layers" (
	"key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"source_date" text,
	"feature_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"error" text,
	"refreshed_at" timestamp with time zone,
	"cursor" jsonb
);
--> statement-breakpoint
CREATE TABLE "risk_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"layer" text NOT NULL,
	"category" text NOT NULL,
	"class_name" text,
	"level" smallint DEFAULT 0 NOT NULL,
	"name" text,
	"properties" jsonb,
	"geom" geometry(Geometry,4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "urban_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text,
	"osm_class" text,
	"geom" geometry(Geometry,4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"list_id" integer NOT NULL,
	"property_id" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_list_id_property_id_pk" PRIMARY KEY("list_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"property_id" integer,
	"saved_search_id" integer,
	"dedup_key" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"emailed_at" timestamp with time zone,
	"telegram_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"notify_new" boolean DEFAULT true NOT NULL,
	"notify_drop" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"password_hash" text,
	"notify_email" text,
	"telegram_chat_id" text,
	"notifications_seen_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings_raw" ADD CONSTRAINT "listings_raw_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possible_duplicates" ADD CONSTRAINT "possible_duplicates_a_listings_id_fk" FOREIGN KEY ("a") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possible_duplicates" ADD CONSTRAINT "possible_duplicates_b_listings_id_fk" FOREIGN KEY ("b") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_run_id_collection_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."collection_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_list_id_favorite_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."favorite_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_saved_search_id_saved_searches_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listings_source_external" ON "listings" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "listings_property" ON "listings" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "listings_status" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_raw_unique" ON "listings_raw" USING btree ("source_id","external_id","hash");--> statement-breakpoint
CREATE INDEX "listings_raw_fetched" ON "listings_raw" USING btree ("fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "possible_duplicates_pair" ON "possible_duplicates" USING btree ("a","b");--> statement-breakpoint
CREATE INDEX "price_history_listing" ON "price_history" USING btree ("listing_id","observed_at");--> statement-breakpoint
CREATE INDEX "price_history_property" ON "price_history" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "properties_geom" ON "properties" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "properties_status" ON "properties" USING btree ("status");--> statement-breakpoint
CREATE INDEX "properties_neighborhood" ON "properties" USING btree ("neighborhood_key");--> statement-breakpoint
CREATE INDEX "properties_total" ON "properties" USING btree ("total_cents");--> statement-breakpoint
CREATE INDEX "properties_search" ON "properties" USING gin ("search" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "source_runs_source" ON "source_runs" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "areas_kind_name" ON "areas" USING btree ("kind","name_key");--> statement-breakpoint
CREATE INDEX "areas_geom" ON "areas" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "risk_areas_geom" ON "risk_areas" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "risk_areas_layer" ON "risk_areas" USING btree ("layer");--> statement-breakpoint
CREATE INDEX "urban_features_geom" ON "urban_features" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "urban_features_kind" ON "urban_features" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "favorites_property" ON "favorites" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedup" ON "notifications" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX "notifications_created" ON "notifications" USING btree ("created_at");