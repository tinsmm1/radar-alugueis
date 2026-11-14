import "server-only";
import { VectorTile, type VectorTileFeature } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { areas, layers, urbanFeatures } from "@/db/schema";
import { BH_BBOX, tilesFor } from "@/domain/geo";
import { OSM_SOURCE, type UrbanKind } from "@/domain/layers";
import { normalizeText } from "@/domain/text";
import { safeFetch } from "../http";
import { assignBairroRegionals } from "./regionais";

const TILEJSON = "https://tiles.openfreemap.org/planet";
const ZOOM = 14;

/** OpenMapTiles feature → urban kind (null = not used). Pure, exported for tests. */
export function classify(layer: string, p: Record<string, unknown>): UrbanKind | "bairro" | null {
  const cls = String(p.class ?? "");
  const sub = String(p.subclass ?? "");
  switch (layer) {
    case "waterway":
      if (!["river", "stream", "canal", "drain", "ditch"].includes(cls)) return null;
      return p.brunnel === "tunnel" ? "curso_dagua_canalizado" : "curso_dagua";
    case "transportation":
      if (["motorway", "trunk", "primary"].includes(cls) && p.brunnel !== "tunnel") return "via_principal";
      if (cls === "rail" && (sub === "rail" || sub === "")) return "ferrovia";
      return null;
    case "aeroway":
      return ["aerodrome", "runway"].includes(cls) ? "aeroporto" : null;
    case "aerodrome_label":
      return "aeroporto";
    case "landuse":
      return cls === "industrial" ? "industrial" : null;
    case "landcover":
      return sub === "park" ? "parque" : null;
    case "park":
      return "parque";
    case "place":
      return cls === "suburb" || cls === "neighbourhood" ? "bairro" : null;
    case "poi":
      if (cls === "hospital" && sub === "hospital") return "hospital";
      if (cls === "grocery" && sub === "supermarket") return "supermercado";
      if (sub === "pharmacy" || sub === "chemist" || cls === "pharmacy") return "farmacia";
      if (cls === "railway" && sub === "subway") return "metro";
      if (cls === "railway" && sub === "station") return "metro";
      if (cls === "bus" && sub === "bus_station") return "estacao_onibus";
      if (cls === "park") return "parque";
      if (cls === "school" && (sub === "school" || sub === "kindergarten")) return "escola";
      if (["town_hall", "police", "fire_station", "library", "community_centre", "post_office"].includes(cls)) return "equipamento_publico";
      return null;
    default:
      return null;
  }
}

const USED = ["waterway", "transportation", "aeroway", "aerodrome_label", "landuse", "landcover", "park", "place", "poi"];

/** Tiles covering BH at z14, in a stable order (the cursor is an index into this list). */
export function osmTiles() {
  return tilesFor(BH_BBOX, ZOOM);
}

async function tileUrlTemplate(): Promise<string> {
  const res = await safeFetch(TILEJSON, { accept: "application/json", timeoutMs: 20_000 });
  const tj = JSON.parse(res.body.toString("utf8")) as { tiles?: string[] };
  if (!tj.tiles?.[0]) throw new Error("OpenFreeMap sem endereço de tiles.");
  return tj.tiles[0];
}

/** Points are kept only inside their own tile (tiles carry a buffer), so they are not duplicated. */
function insideTile(f: VectorTileFeature): boolean {
  if (f.type !== 1) return true;
  const [pt] = f.loadGeometry()[0] ?? [];
  return Boolean(pt) && pt.x >= 0 && pt.y >= 0 && pt.x < f.extent && pt.y < f.extent;
}

type Row = { kind: UrbanKind | "bairro"; name: string | null; osmClass: string; geojson: string };

export function extractTile(buffer: Uint8Array, x: number, y: number): Row[] {
  const tile = new VectorTile(new PbfReader(buffer));
  const rows: Row[] = [];
  for (const name of USED) {
    const layer = tile.layers[name];
    if (!layer) continue;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      const kind = classify(name, f.properties);
      if (!kind || !insideTile(f)) continue;
      const label = (f.properties["name:pt"] ?? f.properties.name ?? null) as string | null;
      rows.push({ kind, name: label, osmClass: `${name}:${f.properties.class ?? ""}/${f.properties.subclass ?? ""}`, geojson: JSON.stringify(f.toGeoJSON(x, y, ZOOM).geometry) });
    }
  }
  return rows;
}

/**
 * Loads the next OSM tiles until the deadline (resumable: the cursor lives in `layers`).
 * The first step clears the previous load; the layer is "ok" only after the last tile, and the
 * analysis waits for it.
 */
export async function loadOsmStep(deadline: number): Promise<{ done: boolean; index: number; total: number }> {
  const db = getDb();
  const tiles = osmTiles();
  const [state] = await db.select().from(layers).where(eq(layers.key, "osm")).limit(1);
  let cursor = (state?.status === "carregando" ? (state.cursor as { index: number; template: string } | null) : null) ?? null;
  if (!cursor) {
    cursor = { index: 0, template: await tileUrlTemplate() };
    // A full reload replaces every urban feature (intentional: the layer is rebuilt from tiles).
    await db.delete(urbanFeatures).where(sql`true`);
    await db.delete(areas).where(eq(areas.source, "osm"));
    await db
      .insert(layers)
      .values({ key: "osm", title: "Infraestrutura urbana (OpenStreetMap)", category: "infraestrutura", source: OSM_SOURCE.source, sourceUrl: OSM_SOURCE.url, status: "carregando", cursor })
      .onConflictDoUpdate({ target: layers.key, set: { status: "carregando", cursor, error: null } });
  }
  while (cursor.index < tiles.length && Date.now() < deadline - 4_000) {
    const { x, y } = tiles[cursor.index];
    const res = await safeFetch(cursor.template.replace("{z}", String(ZOOM)).replace("{x}", String(x)).replace("{y}", String(y)), { timeoutMs: 20_000, maxBytes: 8 * 1024 * 1024 });
    if (res.status === 200 && res.body.length) {
      const rows = extractTile(new Uint8Array(res.body), x, y);
      const urban = rows.filter((r) => r.kind !== "bairro");
      for (let i = 0; i < urban.length; i += 300) {
        await db.insert(urbanFeatures).values(urban.slice(i, i + 300).map((r) => ({ kind: r.kind, name: r.name, osmClass: r.osmClass, geom: sql`ST_SetSRID(ST_GeomFromGeoJSON(${r.geojson}), 4326)` })) as never);
      }
      for (const b of rows.filter((r) => r.kind === "bairro" && r.name)) {
        await db
          .insert(areas)
          .values({ kind: "bairro", name: b.name!, nameKey: normalizeText(b.name), geom: sql`ST_SetSRID(ST_GeomFromGeoJSON(${b.geojson}), 4326)`, source: "osm" } as never)
          .onConflictDoNothing();
      }
    } else if (res.status !== 204 && res.status !== 404) {
      throw new Error(`OpenFreeMap respondeu HTTP ${res.status} no tile ${x}/${y}.`);
    }
    cursor.index++;
    await db.update(layers).set({ cursor }).where(eq(layers.key, "osm"));
  }
  if (cursor.index >= tiles.length) {
    const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(urbanFeatures);
    await assignBairroRegionals();
    await db.update(layers).set({ status: "ok", cursor: null, featureCount: count?.n ?? 0, refreshedAt: new Date(), sourceDate: new Date().toISOString().slice(0, 10) }).where(eq(layers.key, "osm"));
    return { done: true, index: tiles.length, total: tiles.length };
  }
  return { done: false, index: cursor.index, total: tiles.length };
}
