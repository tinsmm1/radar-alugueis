import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { placeScore } from "@/domain/evaluation";

export type NeighborhoodStats = {
  key: string;
  name: string;
  regional: string | null;
  count: number;
  demoCount: number;
  medianRentCents: number | null;
  medianTotalCents: number | null;
  medianCostM2Cents: number | null;
  avgAreaM2: number | null;
  /** Buy mode: median asking price, price per m² and estimated gross yield. */
  medianPriceCents: number | null;
  medianPriceM2Cents: number | null;
  medianYieldBp: number | null;
  partialPct: number;
  floodPct: number | null;
  avgRisk: number | null;
  /** Counts within 1 km of the neighbourhood centre (OSM). */
  hospitals: number;
  supermarkets: number;
  pharmacies: number;
  parks: number;
  transitStations: number;
  /** Distance from the centre to the nearest metro or BRT/bus station (m). */
  nearestTransitM: number | null;
  centreSource: "osm" | "imoveis";
  /** Mean evaluation of its offers in the mode and how many are graded B or better. */
  avgEval: number | null;
  goodOffers: number;
  /** Place grade (risk + services, independent of prices) and its reasons. */
  place: ReturnType<typeof placeScore>;
};

const num = (v: unknown) => (v == null ? null : Number(v));
const round = (v: unknown) => (num(v) == null ? null : Math.round(Number(v)));

type Mode = "aluguel" | "compra";
const evalCol = (mode: Mode) => (mode === "compra" ? sql`sale_eval_score` : sql`rent_eval_score`);
const inMode = (mode: Mode) => (mode === "compra" ? sql`for_sale` : sql`for_rent`);
/** Share of properties whose recurring costs are incomplete in each mode. */
const partial = (mode: Mode) => (mode === "compra" ? sql`(condo_cents is null or iptu_monthly_cents is null)` : sql`cost_status <> 'completo'`);
const saleMedians = sql`
  percentile_cont(0.5) within group (order by sale_price_cents) as med_price,
  percentile_cont(0.5) within group (order by sale_price_m2_cents) as med_price_m2,
  percentile_cont(0.5) within group (order by gross_yield_bp) as med_yield`;

/**
 * One row per neighbourhood with active properties: market (medians), cost/m², partial costs,
 * risk share and infrastructure around its centre (OSM neighbourhood point, or the centroid of
 * its properties when OSM has no point for that name).
 */
export async function neighborhoodStats(mode: Mode = "aluguel"): Promise<NeighborhoodStats[]> {
  const { rows } = await getDb().execute<Record<string, unknown>>(sql`
    with market as (
      select neighborhood_key as key, min(neighborhood) as name, mode() within group (order by regional) as regional,
        count(*)::int as count, count(*) filter (where is_demo)::int as demo_count,
        percentile_cont(0.5) within group (order by rent_cents) as med_rent,
        percentile_cont(0.5) within group (order by total_cents) as med_total,
        percentile_cont(0.5) within group (order by cost_per_m2_cents) as med_m2,
        avg(area_m2) as avg_area, ${saleMedians},
        100.0 * count(*) filter (where ${partial(mode)}) / count(*) as partial_pct,
        100.0 * count(*) filter (where flood_level > 0) / nullif(count(*) filter (where analyzed_at is not null), 0) as flood_pct,
        avg(risk_score) as avg_risk,
        avg(${evalCol(mode)}) as avg_eval, count(*) filter (where ${evalCol(mode)} >= 65)::int as good_offers,
        ST_Centroid(ST_Collect(geom)) as prop_centre
      from properties
      where status <> 'indisponivel' and listing_count > 0 and neighborhood_key is not null and ${inMode(mode)}
      group by neighborhood_key
    ), centred as (
      select m.*, coalesce((select a.geom from areas a where a.kind = 'bairro' and a.name_key = m.key limit 1), m.prop_centre) as centre,
        exists (select 1 from areas a where a.kind = 'bairro' and a.name_key = m.key) as osm_centre
      from market m
    )
    select c.*,
      (select count(*) from urban_features u where u.kind = 'hospital' and u.geom && ST_Expand(c.centre, 0.012) and ST_DWithin(u.geom::geography, c.centre::geography, 1000))::int as hospitals,
      (select count(*) from urban_features u where u.kind = 'supermercado' and u.geom && ST_Expand(c.centre, 0.012) and ST_DWithin(u.geom::geography, c.centre::geography, 1000))::int as supermarkets,
      (select count(*) from urban_features u where u.kind = 'farmacia' and u.geom && ST_Expand(c.centre, 0.012) and ST_DWithin(u.geom::geography, c.centre::geography, 1000))::int as pharmacies,
      (select count(*) from urban_features u where u.kind = 'parque' and u.geom && ST_Expand(c.centre, 0.012) and ST_DWithin(u.geom::geography, c.centre::geography, 1000))::int as parks,
      (select count(*) from urban_features u where u.kind in ('metro', 'estacao_onibus') and u.geom && ST_Expand(c.centre, 0.012) and ST_DWithin(u.geom::geography, c.centre::geography, 1000))::int as transit,
      (select ST_Distance(u.geom::geography, c.centre::geography) from urban_features u where u.kind in ('metro', 'estacao_onibus') order by u.geom <-> c.centre limit 1) as nearest_transit
    from centred c
    order by c.count desc, c.name`);
  return rows.map((r) => ({
    key: String(r.key),
    name: String(r.name),
    regional: (r.regional as string | null) ?? null,
    count: Number(r.count),
    demoCount: Number(r.demo_count),
    medianRentCents: num(r.med_rent) == null ? null : Math.round(Number(r.med_rent)),
    medianTotalCents: num(r.med_total) == null ? null : Math.round(Number(r.med_total)),
    medianCostM2Cents: num(r.med_m2) == null ? null : Math.round(Number(r.med_m2)),
    avgAreaM2: num(r.avg_area) == null ? null : Math.round(Number(r.avg_area)),
    medianPriceCents: round(r.med_price),
    medianPriceM2Cents: round(r.med_price_m2),
    medianYieldBp: round(r.med_yield),
    partialPct: Math.round(Number(r.partial_pct ?? 0)),
    floodPct: num(r.flood_pct) == null ? null : Math.round(Number(r.flood_pct)),
    avgRisk: num(r.avg_risk) == null ? null : Math.round(Number(r.avg_risk)),
    hospitals: Number(r.hospitals ?? 0),
    supermarkets: Number(r.supermarkets ?? 0),
    pharmacies: Number(r.pharmacies ?? 0),
    parks: Number(r.parks ?? 0),
    transitStations: Number(r.transit ?? 0),
    nearestTransitM: num(r.nearest_transit) == null ? null : Math.round(Number(r.nearest_transit)),
    centreSource: r.osm_centre ? "osm" : "imoveis",
    avgEval: round(r.avg_eval),
    goodOffers: Number(r.good_offers ?? 0),
  })).map((n) => ({ ...n, place: placeScore(n) })) as NeighborhoodStats[];
}

export type RegionalStats = Pick<NeighborhoodStats, "name" | "count" | "demoCount" | "medianRentCents" | "medianTotalCents" | "medianCostM2Cents" | "avgAreaM2" | "medianPriceCents" | "medianPriceM2Cents" | "medianYieldBp" | "partialPct" | "floodPct" | "avgRisk"> & { neighborhoods: number };

/** Same market and risk figures per Regional of Belo Horizonte. */
export async function regionalStats(mode: Mode = "aluguel"): Promise<RegionalStats[]> {
  const { rows } = await getDb().execute<Record<string, unknown>>(sql`
    select regional as name, count(*)::int as count, count(*) filter (where is_demo)::int as demo_count,
      count(distinct neighborhood_key)::int as neighborhoods,
      percentile_cont(0.5) within group (order by rent_cents) as med_rent,
      percentile_cont(0.5) within group (order by total_cents) as med_total,
      percentile_cont(0.5) within group (order by cost_per_m2_cents) as med_m2,
      avg(area_m2) as avg_area, ${saleMedians},
      100.0 * count(*) filter (where ${partial(mode)}) / count(*) as partial_pct,
      100.0 * count(*) filter (where flood_level > 0) / nullif(count(*) filter (where analyzed_at is not null), 0) as flood_pct,
      avg(risk_score) as avg_risk
    from properties
    where status <> 'indisponivel' and listing_count > 0 and regional is not null and ${inMode(mode)}
    group by regional order by regional`);
  return rows.map((r) => ({
    name: String(r.name),
    count: Number(r.count),
    demoCount: Number(r.demo_count),
    neighborhoods: Number(r.neighborhoods),
    medianRentCents: num(r.med_rent) == null ? null : Math.round(Number(r.med_rent)),
    medianTotalCents: num(r.med_total) == null ? null : Math.round(Number(r.med_total)),
    medianCostM2Cents: num(r.med_m2) == null ? null : Math.round(Number(r.med_m2)),
    avgAreaM2: num(r.avg_area) == null ? null : Math.round(Number(r.avg_area)),
    medianPriceCents: round(r.med_price),
    medianPriceM2Cents: round(r.med_price_m2),
    medianYieldBp: round(r.med_yield),
    partialPct: Math.round(Number(r.partial_pct ?? 0)),
    floodPct: num(r.flood_pct) == null ? null : Math.round(Number(r.flood_pct)),
    avgRisk: num(r.avg_risk) == null ? null : Math.round(Number(r.avg_risk)),
  }));
}
