ALTER TABLE "settings" ADD COLUMN "collect_filters" jsonb;--> statement-breakpoint
-- Only apartments and houses: drop commercial listings, land and farms already collected via Apify.
DELETE FROM "listings" l USING "listings_raw" r, "sources" s
WHERE s.id = l.source_id AND s.adapter = 'apify' AND r.source_id = l.source_id AND r.external_id = l.external_id
  AND (coalesce(r.payload->>'usageType', '') ILIKE '%COMMERCIAL%'
    OR coalesce(r.payload->>'unitType', r.payload->>'unitTypes', '') ~* '(COMMERCIAL|OFFICE|BUSINESS|SHED|DEPOSIT|WAREHOUSE|LAND|ALLOTMENT|FARM|RANCH|BUILDING|STORE|HOTEL|PARKING)');
--> statement-breakpoint
DELETE FROM "properties" p WHERE NOT EXISTS (SELECT 1 FROM "listings" l WHERE l.property_id = p.id);
