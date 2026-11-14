import { customType, doublePrecision, index, integer, jsonb, pgTable, serial, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/** A WGS84 point (property locations); written with ST_SetSRID(ST_MakePoint(lng, lat), 4326). */
export const pointGeometry = customType<{ data: string; driverData: string }>({
  dataType: () => "geometry(Point,4326)",
});

/** Any PostGIS geometry in WGS84 (polygons, lines, points). Read/written as GeoJSON via SQL. */
export const anyGeometry = customType<{ data: string; driverData: string }>({
  dataType: () => "geometry(Geometry,4326)",
});

/** Geocoding cache (Nominatim results, also failures with precision null). */
export const geolocations = pgTable("geolocations", {
  id: serial("id").primaryKey(),
  addressKey: text("address_key").notNull().unique(),
  query: text("query").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  /** exata | rua | bairro | null (not found) */
  precision: text("precision"),
  provider: text("provider").notNull().default("nominatim"),
  displayName: text("display_name"),
  neighborhood: text("neighborhood"),
  regional: text("regional"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Risk polygons: SGB susceptibility, SGB mapped risk and the owner's imports (PBH, Defesa Civil). */
export const riskAreas = pgTable(
  "risk_areas",
  {
    id: serial("id").primaryKey(),
    layer: text("layer").notNull(),
    /** risco_mapeado | suscetibilidade | ocorrencia_historica */
    category: text("category").notNull(),
    className: text("class_name"),
    level: smallint("level").notNull().default(0),
    name: text("name"),
    properties: jsonb("properties"),
    geom: anyGeometry("geom").notNull(),
  },
  (t) => [index("risk_areas_geom").using("gist", t.geom), index("risk_areas_layer").on(t.layer)],
);

/** Urban features from OpenStreetMap (waterways, roads, rail, transit, services, parks...). */
export const urbanFeatures = pgTable(
  "urban_features",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    name: text("name"),
    osmClass: text("osm_class"),
    geom: anyGeometry("geom").notNull(),
  },
  (t) => [index("urban_features_geom").using("gist", t.geom), index("urban_features_kind").on(t.kind)],
);

/** Administrative areas: regionais (polygons) and bairros (polygon or point). */
export const areas = pgTable(
  "areas",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(), // regional | bairro
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    regional: text("regional"),
    geom: anyGeometry("geom").notNull(),
    source: text("source").notNull(),
  },
  (t) => [uniqueIndex("areas_kind_name").on(t.kind, t.nameKey), index("areas_geom").using("gist", t.geom)],
);

/** Catalogue of loaded layers: what, from where, when, how many features, last error. */
export const layers = pgTable("layers", {
  key: text("key").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  sourceDate: text("source_date"),
  featureCount: integer("feature_count").notNull().default(0),
  /** ok | erro | pendente */
  status: text("status").notNull().default("pendente"),
  error: text("error"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }),
  /** Progress cursor of multi-step loads (OSM tiles). */
  cursor: jsonb("cursor"),
});
