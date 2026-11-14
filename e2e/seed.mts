// E2E fixtures: synthetic layers around central BH (flagged "teste"), 30 bairro points, demo
// listings and one owner-uploaded listing; then a full run without network-bound stages.
import { sql } from "drizzle-orm";
import { closeDatabase, getDb } from "@/db";
import { areas, layers, riskAreas, urbanFeatures } from "@/db/schema/geo";
import { sources } from "@/db/schema/listings";
import { EMPTY_LISTING } from "@/domain/listing";
import { seedDemo } from "@/server/collect/demo";
import { refreshOpportunities } from "@/server/collect/opportunities";
import { storeListings } from "@/server/collect/source-run";
import { analyzePending } from "@/server/geo/analyze";
import { ensureSeeded } from "@/server/settings";

const db = getDb();
await ensureSeeded();
const now = new Date();
for (const key of ["sgb_inundacao", "sgb_movimento_massa", "sgb_enxurrada", "sgb_risco_geologico", "regionais", "osm"]) {
  await db.insert(layers).values({ key, title: `Camada de teste ${key}`, category: key === "osm" || key === "regionais" ? "infraestrutura" : "suscetibilidade", source: "Fixture de teste E2E", status: "ok", featureCount: 1, refreshedAt: now });
}
const poly = (w: number, s: number, e: number, n: number) => sql`ST_SetSRID(ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}), 4326)`;
await db.insert(areas).values({ kind: "regional", name: "Centro-Sul", nameKey: "centro sul", regional: "Centro-Sul", source: "teste", geom: sql`ST_Multi(${poly(-43.97, -19.97, -43.9, -19.9)})` } as never);
for (let i = 0; i < 30; i++) {
  await db.insert(areas).values({ kind: "bairro", name: `Bairro Teste ${String(i + 1).padStart(2, "0")}`, nameKey: `bairro teste ${String(i + 1).padStart(2, "0")}`, regional: "Centro-Sul", source: "osm", geom: sql`ST_SetSRID(ST_MakePoint(${-43.96 + (i % 6) * 0.01}, ${-19.96 + Math.floor(i / 6) * 0.01}), 4326)` } as never);
}
await db.insert(riskAreas).values({ layer: "sgb_inundacao", category: "suscetibilidade", className: "Alta", level: 3, name: "Inundação", geom: poly(-43.962, -19.962, -43.948, -19.948) } as never);
await db.insert(urbanFeatures).values([
  { kind: "metro", name: "Estação Teste", geom: sql`ST_SetSRID(ST_MakePoint(-43.94, -19.93), 4326)` },
  { kind: "curso_dagua_canalizado", name: "Córrego Teste", geom: sql`ST_SetSRID(ST_MakeLine(ST_MakePoint(-43.97, -19.95), ST_MakePoint(-43.90, -19.95)), 4326)` },
] as never);
await seedDemo(40);
const [planilha] = await db.select().from(sources).where(sql`${sources.key} = 'planilha'`);
await storeListings(planilha, [{ ...EMPTY_LISTING, externalId: "e2e-1", title: "Apartamento real de teste na Rua E2E", type: "apartamento", rentCents: 280_000, condoCents: 60_000, iptuCents: 120_000, iptuPeriod: "anual", areaM2: 80, bedrooms: 2, suites: 1, bathrooms: 2, parking: 1, features: ["elevador", "varanda"], advertiserType: "imobiliaria", neighborhood: "Bairro Teste 08", street: "Rua E2E", number: "100", city: "Belo Horizonte", lat: -19.935, lng: -43.945, url: "https://example.com/anuncio/e2e-1" }], {}, { fullSnapshot: false });
await analyzePending(Date.now() + 120_000, 500);
await refreshOpportunities();
await closeDatabase();
console.log("[e2e] banco preparado");
