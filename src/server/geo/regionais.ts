import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { areas, layers } from "@/db/schema";
import { BH_BBOX } from "@/domain/geo";
import { normalizeText } from "@/domain/text";
import { optionalEnv } from "@/lib/env";
import { politeGap, safeFetch, USER_AGENT_BASE } from "../http";

/** The nine administrative regions (Regionais) of Belo Horizonte. */
export const REGIONAIS = ["Barreiro", "Centro-Sul", "Leste", "Nordeste", "Noroeste", "Norte", "Oeste", "Pampulha", "Venda Nova"] as const;

type Hit = { osm_type?: string; place_rank?: number; geojson?: { type: string } };

/** First administrative relation (rank ≤ 18) with a polygon among the candidates. */
function bestBoundary(hits: Hit[]): Hit | undefined {
  return hits.find((h) => h.osm_type === "relation" && (h.place_rank ?? 99) <= 18 && h.geojson && /Polygon/.test(h.geojson.type));
}

/**
 * Regional polygons from OpenStreetMap through Nominatim (≥ 1.1 s apart). OSM tags some
 * regionais as "Regional X" and others only as "X", so both are tried; a polygon smaller
 * than 5 km² (an office building, not the region) is rejected and replaced.
 */
export async function loadRegionais(deadline: number): Promise<{ done: boolean; loaded: number }> {
  const db = getDb();
  await db.execute(sql`delete from areas where kind = 'regional' and ST_Area(geom::geography) < 5e6`);
  const existing = new Set((await db.select({ k: areas.nameKey }).from(areas).where(and(eq(areas.kind, "regional"), eq(areas.source, "nominatim")))).map((r) => r.k));
  let loaded = existing.size;
  const contact = optionalEnv("GEOCODER_CONTACT");
  for (const name of REGIONAIS) {
    if (existing.has(normalizeText(name))) continue;
    for (const query of [`Regional ${name}, Belo Horizonte, Minas Gerais`, `${name}, Belo Horizonte, Minas Gerais`]) {
      if (Date.now() > deadline - 4_000) return { done: false, loaded };
      const q = new URLSearchParams({ q: query, format: "jsonv2", polygon_geojson: "1", limit: "8", countrycodes: "br", viewbox: `${BH_BBOX.west},${BH_BBOX.north},${BH_BBOX.east},${BH_BBOX.south}`, bounded: "1" });
      await politeGap("nominatim", 1100);
      const res = await safeFetch(`https://nominatim.openstreetmap.org/search?${q}`, { timeoutMs: 20_000, maxBytes: 8 * 1024 * 1024, accept: "application/json", headers: { "user-agent": contact ? `${USER_AGENT_BASE} contato: ${contact}` : USER_AGENT_BASE } });
      if (res.status !== 200) throw new Error(`Nominatim respondeu HTTP ${res.status} para a Regional ${name}.`);
      const hit = bestBoundary(JSON.parse(res.body.toString("utf8")) as Hit[]);
      if (!hit) continue;
      const geom = sql`ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(hit.geojson)}), 4326)), 3))`;
      const { rows } = await db.execute<{ km2: number }>(sql`select ST_Area(${geom}::geography) / 1e6 as km2`);
      if (Number(rows[0]?.km2 ?? 0) < 5) continue;
      await db.insert(areas).values({ kind: "regional", name, nameKey: normalizeText(name), regional: name, source: "nominatim", geom } as never).onConflictDoNothing();
      loaded++;
      break;
    }
  }
  await db
    .insert(layers)
    .values({ key: "regionais", title: "Regionais de Belo Horizonte", category: "infraestrutura", source: "OpenStreetMap (ODbL), via Nominatim", sourceUrl: "https://www.openstreetmap.org/copyright", featureCount: loaded, status: "ok", refreshedAt: new Date() })
    .onConflictDoUpdate({ target: layers.key, set: { featureCount: loaded, status: "ok", error: null, refreshedAt: new Date() } });
  await assignBairroRegionals();
  return { done: true, loaded };
}

/** Bairro points inherit the regional that contains them (whichever layer loads last calls this). */
export async function assignBairroRegionals(): Promise<void> {
  await getDb().execute(sql`update areas b set regional = r.name from areas r where b.kind = 'bairro' and r.kind = 'regional' and ST_Contains(r.geom, b.geom) and b.regional is distinct from r.name`);
}
