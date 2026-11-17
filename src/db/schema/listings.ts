import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, doublePrecision, index, integer, jsonb, pgTable, real, serial, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { pointGeometry } from "./geo";

/** Registered sources: adapters with their configuration, status and portal assessments. */
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  /** Stable key: "demo", "manual", "planilha", "vivareal", "feed-<slug>"... */
  key: text("key").notNull().unique(),
  adapter: text("adapter").notNull(), // vrsync | planilha | manual | demo | portal
  name: text("name").notNull(),
  /** Feed URL (vrsync); null for other adapters. */
  url: text("url"),
  /** ativa | pendente | pausada | bloqueada */
  status: text("status").notNull().default("ativa"),
  /** Who authorized the feed and when (free text written by the owner). */
  authorization: text("authorization"),
  /** Portal assessment: terms, robots, API, verdict and date. */
  assessment: jsonb("assessment"),
  isDemo: boolean("is_demo").notNull().default(false),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastOkAt: timestamp("last_ok_at", { withTimezone: true }),
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Original payloads, scrubbed of contact fields, kept apart from normalized data. */
export const listingsRaw = pgTable(
  "listings_raw",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceId: integer("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    hash: text("hash").notNull(),
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("listings_raw_unique").on(t.sourceId, t.externalId, t.hash), index("listings_raw_fetched").on(t.fetchedAt)],
);

/** Physical property: a group of listings that probably describe the same home. */
export const properties = pgTable(
  "properties",
  {
    id: serial("id").primaryKey(),
    title: text("title"),
    type: text("type"),
    neighborhood: text("neighborhood"),
    neighborhoodKey: text("neighborhood_key"),
    regional: text("regional"),
    street: text("street"),
    number: text("number"),
    geom: pointGeometry("geom"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    /** exata | rua | bairro | aproximada */
    geoPrecision: text("geo_precision"),
    geoSource: text("geo_source"),
    geoTriedAt: timestamp("geo_tried_at", { withTimezone: true }),
    areaM2: real("area_m2"),
    bedrooms: smallint("bedrooms"),
    suites: smallint("suites"),
    bathrooms: smallint("bathrooms"),
    parking: smallint("parking"),
    features: text("features").array().notNull().default(sql`'{}'::text[]`),
    photo: text("photo"),
    /** Lowest rent among active listings and its listing's costs. */
    rentCents: integer("rent_cents"),
    condoCents: integer("condo_cents"),
    iptuMonthlyCents: integer("iptu_monthly_cents"),
    totalCents: integer("total_cents"),
    /** Deals offered by active listings (hub modes). */
    forRent: boolean("for_rent").notNull().default(false),
    forSale: boolean("for_sale").notNull().default(false),
    /** Lowest asking price among listings for sale, its price per m² and history. */
    salePriceCents: bigint("sale_price_cents", { mode: "number" }),
    salePriceM2Cents: integer("sale_price_m2_cents"),
    initialSalePriceCents: bigint("initial_sale_price_cents", { mode: "number" }),
    saleDropBp: integer("sale_drop_bp"),
    saleDroppedAt: timestamp("sale_dropped_at", { withTimezone: true }),
    /** Rent estimated from rental comparables (median rent/m² × area) and the gross yield. */
    estRentCents: integer("est_rent_cents"),
    grossYieldBp: integer("gross_yield_bp"),
    saleOpportunity: jsonb("sale_opportunity"),
    saleOpportunityScore: smallint("sale_opportunity_score").notNull().default(0),
    costStatus: text("cost_status"),
    costPerM2Cents: integer("cost_per_m2_cents"),
    initialRentCents: integer("initial_rent_cents"),
    dropBp: integer("drop_bp"),
    droppedAt: timestamp("dropped_at", { withTimezone: true }),
    listingCount: smallint("listing_count").notNull().default(0),
    advertiserTypes: text("advertiser_types").array().notNull().default(sql`'{}'::text[]`),
    sourceKeys: text("source_keys").array().notNull().default(sql`'{}'::text[]`),
    /** ativo | possivelmente_indisponivel | indisponivel (best among its listings). */
    status: text("status").notNull().default("ativo"),
    isDemo: boolean("is_demo").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Location analysis (facts) and its summaries for filtering. */
    analysis: jsonb("analysis"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    riskScore: smallint("risk_score"),
    riskLevel: text("risk_level"),
    floodLevel: smallint("flood_level"),
    opportunity: jsonb("opportunity"),
    opportunityScore: smallint("opportunity_score").notNull().default(0),
    /** Critical evaluation per mode (src/domain/evaluation.ts): grade, parts, pros and cons. */
    rentEval: jsonb("rent_eval"),
    rentEvalScore: smallint("rent_eval_score"),
    saleEval: jsonb("sale_eval"),
    saleEvalScore: smallint("sale_eval_score"),
    /** Commute to the owner's workplaces at their times (src/domain/commute.ts CommuteSummary). */
    commute: jsonb("commute"),
    /** Weighted average one-way minutes (sort and filter "até X min do trabalho"). */
    commuteMinutes: smallint("commute_minutes"),
    commuteAt: timestamp("commute_at", { withTimezone: true }),
    search: text("search"),
  },
  (t) => [
    index("properties_geom").using("gist", t.geom),
    index("properties_status").on(t.status),
    index("properties_neighborhood").on(t.neighborhoodKey),
    index("properties_total").on(t.totalCents),
    index("properties_sale_price").on(t.salePriceCents),
    index("properties_rent_eval").on(t.rentEvalScore),
    index("properties_sale_eval").on(t.saleEvalScore),
    index("properties_commute").on(t.commuteMinutes),
    index("properties_search").using("gin", sql`${t.search} gin_trgm_ops`),
  ],
);

/** One advertisement in one source. */
export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    propertyId: integer("property_id").references(() => properties.id, { onDelete: "set null" }),
    /** aluguel and/or compra. */
    purposes: text("purposes").array().notNull().default(sql`'{aluguel}'::text[]`),
    salePriceCents: bigint("sale_price_cents", { mode: "number" }),
    rawId: bigint("raw_id", { mode: "number" }),
    url: text("url"),
    title: text("title"),
    description: text("description"),
    type: text("type"),
    rentCents: integer("rent_cents"),
    condoCents: integer("condo_cents"),
    iptuCents: integer("iptu_cents"),
    iptuPeriod: text("iptu_period"),
    otherFeesCents: integer("other_fees_cents"),
    feesNote: text("fees_note"),
    areaM2: real("area_m2"),
    bedrooms: smallint("bedrooms"),
    suites: smallint("suites"),
    bathrooms: smallint("bathrooms"),
    parking: smallint("parking"),
    features: text("features").array().notNull().default(sql`'{}'::text[]`),
    advertiserType: text("advertiser_type"),
    advertiserName: text("advertiser_name"),
    photos: text("photos").array().notNull().default(sql`'{}'::text[]`),
    street: text("street"),
    number: text("number"),
    neighborhood: text("neighborhood"),
    city: text("city"),
    postalCode: text("postal_code"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    addressHidden: boolean("address_hidden").notNull().default(false),
    status: text("status").notNull().default("ativo"),
    missingCount: smallint("missing_count").notNull().default(0),
    isDemo: boolean("is_demo").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    priceChangedAt: timestamp("price_changed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("listings_source_external").on(t.sourceId, t.externalId), index("listings_property").on(t.propertyId), index("listings_status").on(t.status)],
);

/** Every observed price of a listing (first value and each change). */
export const priceHistory = pgTable(
  "price_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
    propertyId: integer("property_id"),
    rentCents: integer("rent_cents"),
    condoCents: integer("condo_cents"),
    iptuCents: integer("iptu_cents"),
    totalCents: integer("total_cents"),
    salePriceCents: bigint("sale_price_cents", { mode: "number" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_history_listing").on(t.listingId, t.observedAt), index("price_history_property").on(t.propertyId)],
);

/** Pairs that look alike but were not merged ("possível duplicado"). */
export const possibleDuplicates = pgTable(
  "possible_duplicates",
  {
    a: integer("a").notNull().references(() => listings.id, { onDelete: "cascade" }),
    b: integer("b").notNull().references(() => listings.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
  },
  (t) => [uniqueIndex("possible_duplicates_pair").on(t.a, t.b)],
);

/** Scheduled or manual collection runs. */
export const collectionRuns = pgTable("collection_runs", {
  id: serial("id").primaryKey(),
  trigger: text("trigger").notNull(),
  status: text("status").notNull().default("running"), // running | ok | partial | failed
  stage: text("stage"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  stats: jsonb("stats"),
  error: text("error"),
});

/** One source inside one run. */
export const sourceRuns = pgTable(
  "source_runs",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id").references(() => collectionRuns.id, { onDelete: "cascade" }),
    sourceId: integer("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // ok | partial | failed | skipped
    attempt: smallint("attempt").notNull().default(1),
    fetched: integer("fetched").notNull().default(0),
    created: integer("created").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    priceChanges: integer("price_changes").notNull().default(0),
    duplicates: integer("duplicates").notNull().default(0),
    missing: integer("missing").notNull().default(0),
    skipped: integer("skipped").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    durationMs: integer("duration_ms"),
  },
  (t) => [index("source_runs_source").on(t.sourceId, t.startedAt)],
);
