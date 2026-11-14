ALTER TABLE "listings" ADD COLUMN "purposes" text[] DEFAULT '{aluguel}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "sale_price_cents" bigint;--> statement-breakpoint
ALTER TABLE "price_history" ADD COLUMN "sale_price_cents" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "for_rent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "for_sale" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "sale_price_cents" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "sale_price_m2_cents" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "initial_sale_price_cents" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "sale_drop_bp" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "sale_dropped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "est_rent_cents" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "gross_yield_bp" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "sale_opportunity" jsonb;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "sale_opportunity_score" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "properties_sale_price" ON "properties" USING btree ("sale_price_cents");--> statement-breakpoint
-- Existing data was rent-only: mark it so (new listings carry their own purposes).
UPDATE "properties" SET "for_rent" = true WHERE "rent_cents" IS NOT NULL;
