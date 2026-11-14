import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { layers, riskAreas } from "@/db/schema";
import { BH_BBOX } from "@/domain/geo";
import { classLevel, RISK_LAYERS, type RiskLayerKey } from "@/domain/layers";
import { safeFetch } from "../http";

const WFS = "https://geoservicos.sgb.gov.br/geoserver/wfs";
const TYPE: Record<RiskLayerKey, string> = {
  sgb_inundacao: "gestao-territorial:suscet_inundacao",
  sgb_movimento_massa: "gestao-territorial:suscet_movimento_de_massa",
  sgb_enxurrada: "gestao-territorial:suscet_enxurrada",
  sgb_risco_geologico: "gestao-territorial:risco_geologico",
};

type Feature = { geometry: unknown; properties: Record<string, unknown> | null };

/** Class and display name of an SGB feature (susceptibility class or the risk sector's typology). */
function describe(key: RiskLayerKey, p: Record<string, unknown>): { className: string | null; name: string | null } {
  if (key === "sgb_risco_geologico") {
    const grau = String(p.grau_risco ?? p.grau ?? p.nivel_risco ?? "") || null;
    return { className: grau, name: [p.tipolo_g1, p.local].filter(Boolean).join(" · ") || "Setor de risco geológico" };
  }
  return { className: (p.classe as string) ?? null, name: (p.processo as string) ?? null };
}

/**
 * Replaces one SGB layer with the features inside the BH bounding box (official WFS, GeoJSON,
 * EPSG:4326). Geometries are repaired with ST_MakeValid. All-or-nothing per layer.
 */
export async function loadSgbLayer(key: RiskLayerKey): Promise<number> {
  const src = RISK_LAYERS[key];
  const db = getDb();
  const bbox = `${BH_BBOX.west},${BH_BBOX.south},${BH_BBOX.east},${BH_BBOX.north},EPSG:4326`;
  const url = `${WFS}?service=WFS&version=1.1.0&request=GetFeature&typeName=${TYPE[key]}&outputFormat=application/json&srsName=EPSG:4326&bbox=${bbox}&maxFeatures=10000`;
  try {
    const res = await safeFetch(url, { maxBytes: 60 * 1024 * 1024, timeoutMs: 120_000, accept: "application/json" });
    if (res.status !== 200) throw new Error(`WFS do SGB respondeu HTTP ${res.status}.`);
    const data = JSON.parse(res.body.toString("utf8")) as { features?: Feature[] };
    const features = (data.features ?? []).filter((f) => f.geometry);
    await db.transaction(async (tx) => {
      await tx.delete(riskAreas).where(eq(riskAreas.layer, key));
      for (let i = 0; i < features.length; i += 200) {
        const chunk = features.slice(i, i + 200).map((f) => {
          const p = f.properties ?? {};
          const d = describe(key, p);
          return {
            layer: key,
            category: src.category,
            className: d.className,
            level: key === "sgb_risco_geologico" ? Math.max(2, classLevel(d.className)) : classLevel(d.className),
            name: d.name,
            properties: { municipio: p.municipio ?? null, ano: p.ano ?? null, data_setor: p.data_setor ?? null, fonte: p.fonte ?? null, executor: p.executor ?? null },
            geom: sql`ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(f.geometry)}), 4326)), 3))`,
          };
        });
        await tx.insert(riskAreas).values(chunk as never);
      }
      await tx
        .insert(layers)
        .values({ key, title: src.title, category: src.category, source: src.source, sourceUrl: src.url, sourceDate: src.date, featureCount: features.length, status: "ok", error: null, refreshedAt: new Date() })
        .onConflictDoUpdate({ target: layers.key, set: { featureCount: features.length, status: "ok", error: null, refreshedAt: new Date() } });
    });
    return features.length;
  } catch (err) {
    const message = (err as Error).message.slice(0, 300);
    await db
      .insert(layers)
      .values({ key, title: src.title, category: src.category, source: src.source, sourceUrl: src.url, sourceDate: src.date, status: "erro", error: message })
      .onConflictDoUpdate({ target: layers.key, set: { status: sql`case when ${layers.featureCount} > 0 then 'ok' else 'erro' end`, error: message } });
    throw err;
  }
}
