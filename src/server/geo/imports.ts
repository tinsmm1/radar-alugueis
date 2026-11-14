import "server-only";
import { eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { layers, properties, riskAreas } from "@/db/schema";
import { classLevel } from "@/domain/layers";
import { normalizeText } from "@/domain/text";

/** Metadata the owner fills when importing an official layer (PBH, Defesa Civil, etc.). */
export const importMetaSchema = z.object({
  title: z.string().trim().min(3, "Dê um nome à camada.").max(120),
  category: z.enum(["risco_mapeado", "suscetibilidade", "ocorrencia_historica"]),
  source: z.string().trim().min(3, "Informe a fonte oficial.").max(200),
  sourceUrl: z.url("Link da fonte inválido.").max(500).refine((u) => /^https?:\/\//i.test(u), "Use um link http(s).").optional().or(z.literal("").transform(() => undefined)),
  sourceDate: z.string().trim().max(40).optional(),
});
export type ImportMeta = z.infer<typeof importMetaSchema>;

export class LayerImportError extends Error {}

type GeoFeature = { type: "Feature"; geometry: { type: string } | null; properties?: Record<string, unknown> | null };

const NAME_KEYS = ["nome", "name", "NOME", "Nome", "descricao", "DESCRICAO", "local", "LOCAL", "bairro", "BAIRRO"];
const CLASS_KEYS = ["grau_risco", "GRAU_RISCO", "risco", "RISCO", "classe", "CLASSE", "nivel", "NIVEL", "grau", "GRAU"];

/**
 * Imports a GeoJSON FeatureCollection in WGS84 (EPSG:4326, the GeoJSON standard). Polygons,
 * lines and points are accepted (points/lines are "within N m" checks). Replaces a layer with
 * the same title. Properties are reduced to name and class (no personal data is kept).
 */
export async function importGeoJson(text: string, meta: ImportMeta): Promise<{ key: string; count: number }> {
  let doc: { type?: string; features?: GeoFeature[]; crs?: { properties?: { name?: string } } };
  try {
    doc = JSON.parse(text);
  } catch {
    throw new LayerImportError("O arquivo não é um JSON válido.");
  }
  if (doc.type !== "FeatureCollection" || !Array.isArray(doc.features)) throw new LayerImportError("Envie um GeoJSON do tipo FeatureCollection.");
  const crs = doc.crs?.properties?.name ?? "";
  if (crs && !/4326|CRS84/i.test(crs)) throw new LayerImportError(`O arquivo está em ${crs}. Exporte em WGS84 (EPSG:4326) e envie de novo.`);
  const features = doc.features.filter((f) => f?.geometry && /^(Multi)?(Polygon|LineString|Point)$/.test(f.geometry.type));
  if (!features.length) throw new LayerImportError("Nenhuma geometria válida encontrada.");
  if (features.length > 20_000) throw new LayerImportError("Camada grande demais (máximo de 20.000 feições).");
  const key = `importada:${normalizeText(meta.title).replace(/ /g, "-").slice(0, 60)}`;
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(riskAreas).where(eq(riskAreas.layer, key));
    for (let i = 0; i < features.length; i += 200) {
      const rows = features.slice(i, i + 200).map((f) => {
        const p = f.properties ?? {};
        const name = NAME_KEYS.map((k) => p[k]).find((v) => typeof v === "string" && v.trim()) as string | undefined;
        const cls = CLASS_KEYS.map((k) => p[k]).find((v) => typeof v === "string" && v.trim()) as string | undefined;
        return {
          layer: key, category: meta.category, className: cls?.slice(0, 60) ?? null, level: Math.max(meta.category === "risco_mapeado" ? 2 : 1, classLevel(cls)),
          name: (name ?? meta.title).slice(0, 160), properties: null,
          geom: sql`ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(f.geometry)}), 4326))`,
        };
      });
      await tx.insert(riskAreas).values(rows as never);
    }
    const [outside] = await tx.execute<{ n: number }>(sql`select count(*)::int as n from risk_areas where layer = ${key} and not ST_Intersects(geom, ST_MakeEnvelope(-44.2, -20.2, -43.7, -19.6, 4326))`).then((r) => r.rows);
    if (outside && outside.n === features.length) throw new LayerImportError("Nenhuma feição cai em Belo Horizonte: confira se o arquivo está em WGS84 (latitude/longitude).");
    await tx
      .insert(layers)
      .values({ key, title: meta.title, category: meta.category, source: meta.source, sourceUrl: meta.sourceUrl ?? null, sourceDate: meta.sourceDate || null, featureCount: features.length, status: "ok", refreshedAt: new Date() })
      .onConflictDoUpdate({ target: layers.key, set: { title: meta.title, category: meta.category, source: meta.source, sourceUrl: meta.sourceUrl ?? null, sourceDate: meta.sourceDate || null, featureCount: features.length, status: "ok", error: null, refreshedAt: new Date() } });
    // Every located property is analysed again with the new layer.
    await tx.update(properties).set({ analyzedAt: null }).where(sql`${properties.geom} is not null`);
  });
  return { key, count: features.length };
}

export async function deleteImportedLayer(key: string): Promise<void> {
  if (!key.startsWith("importada:")) throw new LayerImportError("Só camadas importadas podem ser removidas.");
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(riskAreas).where(eq(riskAreas.layer, key));
    await tx.delete(layers).where(eq(layers.key, key));
    await tx.update(properties).set({ analyzedAt: null }).where(sql`${properties.geom} is not null`);
  });
}

export async function importedLayerKeys(): Promise<string[]> {
  const rows = await getDb().select({ key: layers.key }).from(layers).where(like(layers.key, "importada:%"));
  return rows.map((r) => r.key);
}
