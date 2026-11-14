import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { areas, layers, listings, properties, riskAreas, sources, urbanFeatures } from "@/db/schema";
import { EMPTY_LISTING, type NormalizedListing } from "@/domain/listing";
import { filterSchema, type Filter } from "@/domain/filters";
import { analysisItems } from "@/domain/risk";

const { ensureSeeded } = await import("@/server/settings");
const { storeListings } = await import("@/server/collect/source-run");
const { analyzePending, measure } = await import("@/server/geo/analyze");
const { searchProperties, mapPoints, facets, matchingIds } = await import("@/server/search");
const { importGeoJson, LayerImportError } = await import("@/server/geo/imports");
const { seedDemo, removeDemo } = await import("@/server/collect/demo");
const { assertPublicUrl, safeFetch, isPrivateAddress } = await import("@/server/http");
const { exportPropertiesCsv } = await import("@/server/export");

const square = (lng: number, lat: number, d: number) => ({ type: "Polygon", coordinates: [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]] });
const L = (id: string, over: Partial<NormalizedListing>): NormalizedListing => ({ ...EMPTY_LISTING, externalId: id, type: "apartamento", rentCents: 250_000, condoCents: 50_000, iptuCents: 10_000, iptuPeriod: "mensal", areaM2: 70, bedrooms: 2, bathrooms: 1, parking: 1, city: "Belo Horizonte", ...over });

describe("geography and search", () => {
  beforeAll(async () => {
    await ensureSeeded();
    const db = getDb();
    for (const key of ["sgb_inundacao", "sgb_movimento_massa", "osm"]) await db.insert(layers).values({ key, title: key, category: "suscetibilidade", source: "teste", status: "ok", refreshedAt: new Date() }).onConflictDoUpdate({ target: layers.key, set: { status: "ok" } });
    // A high flood polygon around (-43.95, -19.90) and a metro station 300 m east of it.
    await db.insert(riskAreas).values({ layer: "sgb_inundacao", category: "suscetibilidade", className: "Alta", level: 3, name: "Inundação", geom: sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(square(-43.95, -19.9, 0.001))}), 4326)` } as never);
    await db.insert(urbanFeatures).values({ kind: "metro", name: "Estação Teste", geom: sql`ST_SetSRID(ST_MakePoint(-43.9472, -19.9), 4326)` } as never);
    const s = (await db.insert(sources).values({ key: "geo-src", adapter: "planilha", name: "geo", status: "ativa" }).returning())[0];
    await storeListings(s, [
      L("in-flood", { neighborhood: "Funcionários", street: "Rua A", number: "1", lat: -19.9, lng: -43.95, features: ["elevador", "piscina"], rentCents: 300_000 }),
      L("dry", { neighborhood: "Lourdes", street: "Rua B", number: "2", lat: -19.93, lng: -43.94, bedrooms: 3, areaM2: 100, rentCents: 500_000, advertiserType: "proprietario" }),
      L("no-loc", { neighborhood: "Centro", rentCents: 150_000, condoCents: null }),
    ], {}, { fullSnapshot: false });
  });

  it("measures susceptibility and distances with PostGIS and builds the analysis", async () => {
    const f = await measure(-19.9, -43.95, "exata");
    expect(f.flood).toMatchObject({ insideLevel: 3, insideClass: "Alta" });
    expect(f.nearest.metro?.distanceM).toBeGreaterThan(250);
    expect(f.nearest.metro?.distanceM).toBeLessThan(350);
    expect(f.slopePct).toBe(12);
    const items = analysisItems(f);
    expect(items.find((i) => i.key === "sgb_inundacao")?.level).toBe("alto");
    expect(items.find((i) => i.key === "metro")).toMatchObject({ level: "positivo", description: expect.stringContaining("Estação Teste") });
    const r = await analyzePending(Date.now() + 30_000);
    expect(r.analyzed).toBe(2);
    const [p] = await getDb().select().from(properties).where(eq(properties.neighborhood, "Funcionários"));
    expect(p).toMatchObject({ floodLevel: 3, riskLevel: "atencao" });
  });

  it("every filter field runs as valid SQL", async () => {
    const values: Partial<Filter> = {
      q: "rua", bairros: ["Lourdes"], regionais: ["Centro-Sul"], perto: "-19.93,-43.94", raioKm: 1, bbox: "-44,-20,-43.8,-19.8", aluguelMin: 1, aluguelMax: 9999, condoMin: 0, condoMax: 9999,
      iptuMin: 0, iptuMax: 9999, totalMin: 0, totalMax: 99999, m2Max: 999, areaMin: 1, areaMax: 999, quartosMin: 1, quartosMax: 5, suitesMin: 0, banheirosMin: 1, vagasMin: 0,
      tipos: ["apartamento"], caracteristicas: ["elevador"], recentesDias: 7, atualizadosDias: 7, reducao: true, anunciante: "proprietario", localizacao: "confirmada", custoCompleto: true,
      riscoMax: "moderado", semInundacao: true, oportunidades: true, incluirIndisponiveis: true, favoritos: true, fontes: ["geo-src"],
      precoMin: 1, precoMax: 9_000_000, precoM2Max: 50_000, rendimentoMin: 3.5,
    };
    for (const modo of ["aluguel", "compra"] as const) {
      for (const [k, v] of Object.entries(values)) {
        for (const ordem of ["relevancia", "menor_m2", "menor_risco", "menor_preco", "menor_preco_m2", "maior_rendimento", "maior_reducao", "oportunidade"] as const) {
          await expect(searchProperties(filterSchema.parse({ modo, [k]: v, ordem }))).resolves.toBeDefined();
        }
      }
      await expect(mapPoints(filterSchema.parse({ ...values, modo }))).resolves.toBeDefined();
    }
    await expect(searchProperties(filterSchema.parse(values))).resolves.toBeDefined();
  });

  it("filters return the right properties", async () => {
    const run = async (f: Partial<Filter>) => (await searchProperties(filterSchema.parse({ fontes: ["geo-src"], ...f }))).items.map((i) => i.neighborhood).sort();
    expect(await run({})).toEqual(["Centro", "Funcionários", "Lourdes"]);
    expect(await run({ bairros: ["lourdes"] })).toEqual(["Lourdes"]);
    expect(await run({ caracteristicas: ["piscina"] })).toEqual(["Funcionários"]);
    expect(await run({ totalMax: 3600 })).toEqual(["Centro", "Funcionários"]);
    expect(await run({ custoCompleto: true })).toEqual(["Funcionários", "Lourdes"]);
    expect(await run({ perto: "-19.93,-43.94", raioKm: 0.5 })).toEqual(["Lourdes"]);
    expect(await run({ semInundacao: true })).toEqual(["Lourdes"]);
    expect(await run({ anunciante: "proprietario" })).toEqual(["Lourdes"]);
    expect(await run({ localizacao: "aproximada" })).toEqual(["Centro"]);
    // Buy mode only lists properties for sale (this fixture has none).
    expect(await run({ modo: "compra" })).toEqual([]);
    const stats = (await searchProperties(filterSchema.parse({ fontes: ["geo-src"] }))).stats;
    expect(stats).toMatchObject({ total: 3, minRentCents: 150_000, new24h: 3, located: 2 });
    expect((await mapPoints(filterSchema.parse({ fontes: ["geo-src"] }))).length).toBe(2);
    expect((await facets()).bairros.map((b) => b.name)).toEqual(expect.arrayContaining(["Lourdes", "Centro"]));
    const ids = (await getDb().select({ id: properties.id }).from(properties)).map((r) => r.id);
    expect((await matchingIds(filterSchema.parse({ bairros: ["Centro"] }), ids)).length).toBe(1);
  });

  it("imports an official GeoJSON layer and validates CRS and location", async () => {
    const fc = { type: "FeatureCollection", features: [{ type: "Feature", properties: { nome: "Área de risco R4", grau_risco: "Muito alto" }, geometry: square(-43.94, -19.93, 0.002) }] };
    const meta = { title: "Áreas de risco Urbel", category: "risco_mapeado" as const, source: "PBH/Urbel", sourceDate: "2025" };
    expect(await importGeoJson(JSON.stringify(fc), meta)).toEqual({ key: "importada:areas-de-risco-urbel", count: 1 });
    const f = await measure(-19.93, -43.94, "exata");
    expect(f.coverage.imported).toBe(true);
    expect(f.mapped[0]).toMatchObject({ name: "Área de risco R4", category: "risco_mapeado", distanceM: 0, source: "PBH/Urbel" });
    await expect(importGeoJson(JSON.stringify({ ...fc, crs: { properties: { name: "EPSG:31983" } } }), meta)).rejects.toBeInstanceOf(LayerImportError);
    const far = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: square(-46.6, -23.5, 0.01) }] };
    await expect(importGeoJson(JSON.stringify(far), meta)).rejects.toThrow(/Belo Horizonte/);
    await expect(importGeoJson("{}", meta)).rejects.toBeInstanceOf(LayerImportError);
  });

  it("demo data is flagged everywhere and removable without touching real data", async () => {
    const db = getDb();
    for (let i = 0; i < 25; i++) await db.insert(areas).values({ kind: "bairro", name: `Bairro ${i}`, nameKey: `bairro ${i}`, regional: "Oeste", source: "osm", geom: sql`ST_SetSRID(ST_MakePoint(${-43.99 + i * 0.002}, -19.95), 4326)` } as never);
    const before = (await db.select({ id: properties.id }).from(properties).where(eq(properties.isDemo, false))).length;
    await seedDemo(30);
    const demo = await db.select().from(listings).where(eq(listings.isDemo, true));
    expect(demo.length).toBeGreaterThanOrEqual(30);
    expect(demo.every((l) => l.title?.startsWith("[DEMONSTRAÇÃO]") && l.url == null)).toBe(true);
    expect((await db.select().from(properties).where(eq(properties.isDemo, true))).length).toBeGreaterThan(20);
    await removeDemo();
    expect(await db.select().from(listings).where(eq(listings.isDemo, true))).toHaveLength(0);
    expect(await db.select().from(sources).where(eq(sources.isDemo, true))).toHaveLength(0);
    expect((await db.select({ id: properties.id }).from(properties).where(eq(properties.isDemo, false))).length).toBe(before);
  });

  it("F7: CSV export neutralises spreadsheet formulas from sources", async () => {
    await getDb().update(properties).set({ title: "=HYPERLINK(\"https://evil\")" }).where(eq(properties.neighborhood, "Lourdes"));
    const csv = await exportPropertiesCsv();
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/(^|;)=HYPERLINK/m);
  });

  it("outbound requests refuse private networks (SSRF)", async () => {
    for (const bad of ["http://127.0.0.1/x", "http://localhost/x", "http://10.0.0.5/feed.xml", "http://[::1]/", "file:///etc/passwd", "https://user:pw@example.com/", "http://example.com:8080/"]) {
      expect(() => assertPublicUrl(bad)).toThrow();
    }
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    // F2: IPv6 forms that embed a private IPv4 address.
    for (const ip of ["::ffff:7f00:1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe", "64:ff9b::7f00:1", "2002:7f00:1::", "::7f00:1", "fd00::1", "fe80::1"]) expect(isPrivateAddress(ip), ip).toBe(true);
    expect(isPrivateAddress("2606:4700::6810:84e5")).toBe(false);
    expect(() => assertPublicUrl("http://[::ffff:127.0.0.1]/")).toThrow();
    expect(isPrivateAddress("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    // A public-looking name that resolves to loopback is refused when the socket connects.
    await expect(safeFetch("http://localtest.me/")).rejects.toThrow();
  });
});
