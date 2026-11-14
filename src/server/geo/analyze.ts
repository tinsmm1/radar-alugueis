import "server-only";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { layers, properties } from "@/db/schema";
import { URBAN_KINDS, type UrbanKind } from "@/domain/layers";
import { riskIndex, type LocationFacts, type SusceptibilityFact } from "@/domain/risk";
import { slopeAt } from "./terrain";

type Coverage = LocationFacts["coverage"];

async function coverage(): Promise<Coverage> {
  const rows = await getDb().select({ key: layers.key, status: layers.status }).from(layers);
  const ok = (k: string) => rows.some((r) => r.key === k && r.status === "ok");
  return { sgb: ok("sgb_inundacao") && ok("sgb_movimento_massa"), osm: ok("osm"), terrain: true, imported: rows.some((r) => r.key.startsWith("importada:") && r.status === "ok") };
}

const point = (lat: number, lng: number) => sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;

async function susceptibility(layer: string, lat: number, lng: number): Promise<SusceptibilityFact> {
  const p = point(lat, lng);
  const { rows } = await getDb().execute<{ inside_level: number | null; inside_class: string | null; near_high: number | null }>(sql`
    select
      max(level) filter (where ST_Intersects(geom, ${p})) as inside_level,
      (array_agg(class_name order by level desc) filter (where ST_Intersects(geom, ${p})))[1] as inside_class,
      min(ST_Distance(geom::geography, ${p}::geography)) filter (where level = 3) as near_high
    from risk_areas
    where layer = ${layer} and geom && ST_Expand(${p}, 0.004)`);
  const r = rows[0];
  return { insideLevel: (Number(r?.inside_level ?? 0) as 0 | 1 | 2 | 3) || 0, insideClass: r?.inside_class ?? null, nearHighM: r?.near_high == null ? null : Math.round(Number(r.near_high)) };
}

async function mapped(lat: number, lng: number): Promise<LocationFacts["mapped"]> {
  const p = point(lat, lng);
  const { rows } = await getDb().execute<{ name: string; category: string; source: string; url: string | null; date: string | null; d: number }>(sql`
    select coalesce(r.name, l.title) as name, r.category, l.source, l.source_url as url, l.source_date as date, min(ST_Distance(r.geom::geography, ${p}::geography)) as d
    from risk_areas r join layers l on l.key = r.layer
    where r.category in ('risco_mapeado', 'ocorrencia_historica') and r.geom && ST_Expand(${p}, 0.004)
    group by 1, 2, 3, 4, 5
    having min(ST_Distance(r.geom::geography, ${p}::geography)) <= 300
    order by d limit 8`);
  return rows.map((r) => ({ name: r.name, category: r.category as "risco_mapeado" | "ocorrencia_historica", source: r.source, url: r.url, date: r.date, distanceM: Math.round(Number(r.d)) }));
}

async function nearest(lat: number, lng: number): Promise<LocationFacts["nearest"]> {
  const p = point(lat, lng);
  const kinds = sql.join(URBAN_KINDS.map((k) => sql`${k}`), sql`, `);
  const { rows } = await getDb().execute<{ kind: UrbanKind; name: string | null; d: number }>(sql`
    select k.kind, n.name, n.d from unnest(array[${kinds}]::text[]) as k(kind)
    cross join lateral (
      select u.name, ST_Distance(u.geom::geography, ${p}::geography) as d
      from urban_features u where u.kind = k.kind
      order by u.geom <-> ${p} limit 1
    ) n`);
  const out: LocationFacts["nearest"] = {};
  for (const r of rows) out[r.kind] = { distanceM: Math.round(Number(r.d)), name: r.name };
  return out;
}

/** Measures one location (used by the analysis and by the "analyse an address" tool). */
export async function measure(lat: number, lng: number, precision: LocationFacts["precision"], cov?: Coverage): Promise<LocationFacts> {
  const c = cov ?? (await coverage());
  const [flood, landslide, flash, map, near, slope] = await Promise.all([
    c.sgb ? susceptibility("sgb_inundacao", lat, lng) : null,
    c.sgb ? susceptibility("sgb_movimento_massa", lat, lng) : null,
    c.sgb ? susceptibility("sgb_enxurrada", lat, lng) : null,
    mapped(lat, lng),
    c.osm ? nearest(lat, lng) : {},
    slopeAt(lat, lng),
  ]);
  return {
    precision, coverage: { ...c, terrain: slope != null }, flood, landslide, flashFlood: flash ? { inside: flash.insideLevel > 0 } : null,
    mapped: map, slopePct: slope, nearest: near, analyzedAt: new Date().toISOString(),
  };
}

/** Analyses located properties without a current analysis, until the deadline. */
export async function analyzePending(deadline: number, max = 80): Promise<{ analyzed: number; remaining: boolean; waiting: boolean }> {
  const db = getDb();
  const cov = await coverage();
  // Wait for the OSM load to finish rather than store a half-empty analysis.
  const [osm] = await db.select({ status: layers.status }).from(layers).where(eq(layers.key, "osm"));
  if (osm?.status === "carregando") return { analyzed: 0, remaining: true, waiting: true };
  const pending = await db
    .select({ id: properties.id, lat: properties.lat, lng: properties.lng, precision: properties.geoPrecision })
    .from(properties)
    .where(and(isNotNull(properties.geom), isNull(properties.analyzedAt), sql`${properties.status} <> 'indisponivel'`))
    .limit(max + 1);
  let analyzed = 0;
  for (const p of pending.slice(0, max)) {
    if (Date.now() > deadline - 3_000) break;
    const facts = await measure(p.lat!, p.lng!, p.precision === "exata" || p.precision === "rua" ? "exata" : "aproximada", cov);
    const idx = riskIndex(facts);
    await db
      .update(properties)
      .set({ analysis: facts, analyzedAt: new Date(), riskScore: idx.score, riskLevel: idx.level, floodLevel: facts.flood?.insideLevel ?? null })
      .where(eq(properties.id, p.id));
    analyzed++;
  }
  return { analyzed, remaining: pending.length > analyzed, waiting: false };
}
