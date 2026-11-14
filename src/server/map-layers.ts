import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { MAP_LAYERS } from "@/domain/layers";

/** Layers the map can request: the toggles in MAP_LAYERS plus the clickable bairro points. */
export const LAYER_KEYS = [...MAP_LAYERS.map((l) => l.key), "bairros"] as const;
export type LayerKey = (typeof LAYER_KEYS)[number];

export function isLayerKey(value: string): value is LayerKey {
  return (LAYER_KEYS as readonly string[]).includes(value);
}

type Bbox = { west: number; south: number; east: number; north: number };

/** Geometry expression, its properties (json) and the table filter for each layer. */
function layerQuery(key: LayerKey): { from: SQL; geom: SQL; props: SQL; tolerance: number } {
  const risk = (where: SQL, tolerance = 0.00012) => ({
    from: sql`risk_areas r left join layers l on l.key = r.layer where ${where}`,
    geom: sql`r.geom`,
    props: sql`json_build_object('level', r.level, 'class', r.class_name, 'name', r.name, 'category', r.category, 'layer', coalesce(l.title, r.layer))`,
    tolerance,
  });
  const urban = (kinds: string[], tolerance = 0.00004) => ({
    from: sql`urban_features u where u.kind in (${sql.join(kinds.map((k) => sql`${k}`), sql`, `)})`,
    geom: sql`u.geom`,
    props: sql`json_build_object('kind', u.kind, 'name', u.name)`,
    tolerance,
  });
  switch (key) {
    case "sgb_movimento_massa":
      // Large polygons covering most of the city: a coarser outline keeps the payload small.
      return risk(sql`r.layer = ${key}`, 0.00035);
    case "sgb_inundacao":
    case "sgb_enxurrada":
      return risk(sql`r.layer = ${key}`);
    case "importadas":
      return risk(sql`(r.layer like 'importada:%' or r.layer = 'sgb_risco_geologico')`);
    case "curso_dagua":
      return urban(["curso_dagua", "curso_dagua_canalizado"]);
    case "via_principal":
      return urban(["via_principal"]);
    case "ferrovia":
      return urban(["ferrovia"]);
    case "metro":
      return urban(["metro", "estacao_onibus"], 0);
    case "servicos":
      return urban(["hospital", "supermercado", "farmacia"], 0);
    case "parque":
      return urban(["parque"], 0.00005);
    case "regionais":
      return { from: sql`areas a where a.kind = 'regional'`, geom: sql`a.geom`, props: sql`json_build_object('name', a.name)`, tolerance: 0.0001 };
    case "bairros":
      return { from: sql`areas a where a.kind = 'bairro' and a.regional is not null`, geom: sql`a.geom`, props: sql`json_build_object('name', a.name, 'regional', a.regional)`, tolerance: 0 };
  }
}

const cache = new Map<string, { at: number; json: string }>();
const TTL_MS = 10 * 60_000;

/**
 * One layer as a GeoJSON FeatureCollection string, built by PostGIS (simplified for the screen,
 * 5 decimals ≈ 1 m). Optional bbox limits the area. Cached in memory for a few minutes.
 */
export async function layerGeoJson(key: LayerKey, bbox: Bbox | null): Promise<string> {
  const cacheKey = `${key}|${bbox ? [bbox.west, bbox.south, bbox.east, bbox.north].map((n) => n.toFixed(3)).join(",") : ""}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.json;
  const q = layerQuery(key);
  const simplified = q.tolerance > 0 ? sql`ST_SimplifyPreserveTopology(${q.geom}, ${q.tolerance})` : q.geom;
  const box = bbox ? sql`and ${q.geom} && ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)` : sql``;
  const { rows } = await getDb().execute<{ fc: string }>(sql`
    select json_build_object(
      'type', 'FeatureCollection',
      'features', coalesce(json_agg(json_build_object('type', 'Feature', 'geometry', ST_AsGeoJSON(t.g, 5)::json, 'properties', t.p)), '[]'::json)
    )::text as fc
    from (select ${simplified} as g, ${q.props} as p from ${q.from} ${box} limit 20000) t
    where t.g is not null and not ST_IsEmpty(t.g)`);
  const json = rows[0]?.fc ?? '{"type":"FeatureCollection","features":[]}';
  if (cache.size > 64) cache.clear();
  cache.set(cacheKey, { at: Date.now(), json });
  return json;
}
