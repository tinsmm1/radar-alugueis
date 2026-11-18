"use server";
import { logger } from "@/lib/logger";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { properties, sourceRuns, sources } from "@/db/schema";
import { parseListingsCsv } from "@/domain/csv";
import { normalizedListingSchema, type NormalizedListing } from "@/domain/listing";
import { parseVrsync } from "@/domain/vrsync";
import { DemoError, removeDemo, seedDemo } from "../collect/demo";
import { purgeSource } from "../collect/ingest";
import { refreshProperties } from "../collect/properties";
import { continueRunLater } from "../collect/continue";
import { runStep } from "../collect/run";
import { storeListings } from "../collect/source-run";
import { refreshOpportunities } from "../collect/opportunities";
import { analyzePending } from "../geo/analyze";
import { geocodePending } from "../geo/geocode";
import { deleteImportedLayer, importGeoJson, importMetaSchema, LayerImportError } from "../geo/imports";
import { loadOsmStep } from "../geo/osm";
import { loadRegionais } from "../geo/regionais";
import { loadSgbLayer } from "../geo/sgb";
import { assertPublicUrl, decodeText, FetchError, safeFetch } from "../http";
import { BUSY, withRunLock } from "../run-lock";
import { feedKey } from "../sources/registry";
import { ActionError, parse, runAction } from "./run-action";

const BUDGET_MS = 55_000;

/** Known domain errors become user-facing messages; everything else stays generic. */
async function known<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof LayerImportError || err instanceof DemoError || err instanceof FetchError) throw new ActionError(err.message);
    throw err;
  }
}

async function sourceByKey(key: string) {
  const [s] = await getDb().select().from(sources).where(eq(sources.key, key)).limit(1);
  if (!s) throw new ActionError("Fonte não encontrada.");
  return s;
}

/** Runs the collection pipeline for up to ~55 s (resumes an open run). */
export async function runCollectionNow() {
  return runAction("runCollectionNow", async () => {
    const deadline = Date.now() + BUDGET_MS;
    const result = await withRunLock("collect", async () => {
      let last = await runStep("manual", Math.min(50_000, deadline - Date.now()));
      while (last?.more && deadline - Date.now() > 8_000) last = await runStep("manual", deadline - Date.now() - 2_000);
      return last;
    });
    if (result === BUSY) throw new ActionError("Outra coleta está em andamento. Aguarde alguns instantes.");
    // What does not fit in this click continues by itself in the background.
    if (result?.more) continueRunLater(1);
    return result ?? { runId: 0, stage: "concluido", more: false, note: "" };
  }, "/admin");
}

const feedSchema = z.object({
  name: z.string().trim().min(3, "Dê um nome à fonte (ex.: nome da imobiliária).").max(80),
  url: z.string().trim().min(1, "Informe o endereço do feed.").max(2000),
  authorization: z.string().trim().min(5, "Registre quem autorizou o uso do feed e quando.").max(500),
  confirm: z.literal(true, "Confirme que tem autorização da imobiliária."),
});

export async function addFeed(input: z.input<typeof feedSchema>) {
  return runAction("addFeed", async () => {
    const f = parse(feedSchema, input);
    const url = await known(async () => assertPublicUrl(f.url).toString());
    const key = feedKey(f.name);
    const db = getDb();
    const [exists] = await db.select({ id: sources.id }).from(sources).where(eq(sources.key, key)).limit(1);
    if (exists) throw new ActionError("Já existe uma fonte com esse nome.");
    await db.insert(sources).values({ key, adapter: "vrsync", name: f.name, url, status: "ativa", authorization: f.authorization });
    return { key };
  }, "/admin");
}

/** Downloads and parses a feed without storing anything (preview). */
export async function testFeed(url: string) {
  return runAction("testFeed", () =>
    known(async () => {
      const u = parse(z.string().trim().min(1, "Informe o endereço.").max(2000), url);
      const res = await safeFetch(assertPublicUrl(u).toString(), { maxBytes: 25 * 1024 * 1024, timeoutMs: 40_000, accept: "application/xml,text/xml;q=0.9,*/*;q=0.5" });
      if (res.status !== 200) throw new ActionError(`O feed respondeu HTTP ${res.status}.`);
      const parsed = parseVrsync(decodeText(res.body, res.contentType));
      if (!parsed.ok) throw new ActionError(parsed.error);
      return { provider: parsed.provider, count: parsed.listings.length, skipped: parsed.skipped, sample: parsed.listings.slice(0, 3).map((l) => ({ title: l.title, neighborhood: l.neighborhood, rentCents: l.rentCents })) };
    }),
  );
}

const sourceId = z.int().positive();

export async function setFeedStatus(id: number, status: "ativa" | "pausada") {
  return runAction("setFeedStatus", async () => {
    const st = parse(z.enum(["ativa", "pausada"]), status);
    const db = getDb();
    const rows = await db.update(sources).set({ status: st }).where(and(eq(sources.id, parse(sourceId, id)), inArray(sources.adapter, ["vrsync", "apify"]))).returning({ id: sources.id });
    if (!rows.length) throw new ActionError("Só feeds podem ser pausados.");
  }, "/admin");
}

/** Deletes a feed and its listings; properties are regrouped (favourites are kept). */
export async function deleteFeed(id: number) {
  return runAction("deleteFeed", async () => {
    const sid = parse(sourceId, id);
    const db = getDb();
    const [s] = await db.select().from(sources).where(eq(sources.id, sid)).limit(1);
    if (!s || !["vrsync", "apify"].includes(s.adapter)) throw new ActionError("Só feeds cadastrados podem ser removidos.");
    await refreshProperties(await purgeSource(sid));
    await db.delete(sources).where(eq(sources.id, sid));
  }, "/admin");
}

/** After an upload: locate and analyse what fits in the remaining time (the scheduler finishes the rest). */
async function bestEffortGeo(deadline: number) {
  const geo = await geocodePending(deadline, 25).catch(() => ({ located: 0 }));
  const an = await analyzePending(deadline, 40).catch(() => ({ analyzed: 0 }));
  // Uploads update opportunities, yields and evaluations now, not at the next scheduled run.
  await refreshOpportunities().catch((err: Error) => logger.warn({ msg: err.message }, "opportunity refresh after upload failed"));
  return { located: geo.located, analyzed: an.analyzed };
}

async function recordUpload(sourceIdValue: number, stats: { fetched: number; created: number; updated: number; priceChanges: number; duplicates: number }, skipped: number, started: number) {
  await getDb().insert(sourceRuns).values({ runId: null, sourceId: sourceIdValue, status: "ok", fetched: stats.fetched, created: stats.created, updated: stats.updated, priceChanges: stats.priceChanges, duplicates: stats.duplicates, skipped, durationMs: Date.now() - started });
}

export async function uploadCsv(formData: FormData) {
  return runAction("uploadCsv", async () => {
    const started = Date.now();
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) throw new ActionError("Escolha um arquivo .csv.");
    if (file.size > 10 * 1024 * 1024) throw new ActionError("Arquivo grande demais (máximo de 10 MB).");
    const res = parseListingsCsv(decodeText(Buffer.from(await file.arrayBuffer())));
    if (!res.ok) throw new ActionError(res.error);
    if (!res.listings.length) return { stored: 0, created: 0, updated: 0, unchanged: 0, errors: res.errors.slice(0, 50), errorCount: res.errors.length, located: 0, analyzed: 0 };
    const source = await sourceByKey("planilha");
    const s = await storeListings(source, res.listings, {}, { fullSnapshot: false });
    await recordUpload(source.id, s, res.errors.length, started);
    const geo = await bestEffortGeo(started + 50_000);
    return { stored: res.listings.length, created: s.created, updated: s.updated, unchanged: s.unchanged, errors: res.errors.slice(0, 50), errorCount: res.errors.length, ...geo };
  }, "/admin");
}

const manualSchema = z.object({
  url: z.string().trim().max(2000).optional(),
  title: z.string().trim().min(3, "Informe um título.").max(300),
  type: z.string().optional(),
  purpose: z.enum(["aluguel", "compra", "ambos"]).default("aluguel"),
  rent: z.number().positive().max(1_000_000).nullable(),
  salePrice: z.number().min(10_000, "Preço de venda muito baixo.").max(1_000_000_000).nullable(),
  condo: z.number().min(0).max(500_000).nullable(),
  iptu: z.number().min(0).max(1_000_000).nullable(),
  iptuPeriod: z.enum(["mensal", "anual"]).nullable(),
  area: z.number().positive().max(100_000).nullable(),
  bedrooms: z.int().min(0).max(50).nullable(),
  suites: z.int().min(0).max(50).nullable(),
  bathrooms: z.int().min(0).max(50).nullable(),
  parking: z.int().min(0).max(50).nullable(),
  features: z.array(z.string()).max(30),
  advertiserType: z.enum(["imobiliaria", "proprietario"]).nullable(),
  street: z.string().trim().max(200).optional(),
  number: z.string().trim().max(20).optional(),
  neighborhood: z.string().trim().min(2, "Informe o bairro.").max(120),
});

export async function addManualListing(input: z.input<typeof manualSchema>) {
  return runAction("addManualListing", async () => {
    const started = Date.now();
    const m = parse(manualSchema, input);
    const wantsRent = m.purpose !== "compra";
    const wantsSale = m.purpose !== "aluguel";
    if (wantsRent && !m.rent) throw new ActionError("Informe o aluguel.");
    if (wantsSale && !m.salePrice) throw new ActionError("Informe o preço de venda.");
    const candidate: NormalizedListing = {
      purposes: [...(wantsRent ? (["aluguel"] as const) : []), ...(wantsSale ? (["compra"] as const) : [])],
      salePriceCents: wantsSale && m.salePrice ? Math.round(m.salePrice * 100) : null,
      externalId: `manual-${Date.now()}`, url: m.url || null, title: m.title, description: null, type: (m.type || null) as NormalizedListing["type"],
      rentCents: wantsRent && m.rent ? Math.round(m.rent * 100) : null, condoCents: m.condo == null ? null : Math.round(m.condo * 100), iptuCents: m.iptu == null ? null : Math.round(m.iptu * 100),
      iptuPeriod: m.iptu == null ? null : m.iptuPeriod, otherFeesCents: null, feesNote: null, areaM2: m.area, bedrooms: m.bedrooms, suites: m.suites,
      bathrooms: m.bathrooms, parking: m.parking, features: m.features as NormalizedListing["features"], advertiserType: m.advertiserType, advertiserName: null,
      photos: [], street: m.street || null, number: m.number || null, neighborhood: m.neighborhood, city: "Belo Horizonte", postalCode: null, lat: null, lng: null, addressHidden: false,
    };
    const valid = normalizedListingSchema.safeParse(candidate);
    if (!valid.success) throw new ActionError(`Campo inválido: ${valid.error.issues[0]?.path.join(".") || "dados"}.`);
    const source = await sourceByKey("manual");
    const s = await storeListings(source, [valid.data], {}, { fullSnapshot: false });
    await recordUpload(source.id, s, 0, started);
    return { ...(await bestEffortGeo(started + 40_000)), propertyId: s.touched[0] ?? null };
  }, "/admin");
}

const BUILTIN_LAYERS = ["sgb_inundacao", "sgb_movimento_massa", "sgb_enxurrada", "sgb_risco_geologico", "regionais", "osm"] as const;

/** Refreshes one built-in layer within the time budget; properties are re-analysed when it completes. */
export async function refreshLayer(key: string) {
  return runAction("refreshLayer", () =>
    known(async () => {
      const k = parse(z.enum(BUILTIN_LAYERS), key);
      const deadline = Date.now() + BUDGET_MS;
      let done = true;
      let note = "";
      if (k === "osm") {
        let r = await loadOsmStep(deadline);
        while (!r.done && deadline - Date.now() > 6_000) r = await loadOsmStep(deadline);
        done = r.done;
        note = done ? "OpenStreetMap atualizado." : `Carregados ${r.index} de ${r.total} blocos; a coleta agendada termina o restante.`;
      } else if (k === "regionais") {
        const r = await loadRegionais(deadline);
        done = r.done;
        note = `${r.loaded} regionais carregadas.`;
      } else {
        note = `${await loadSgbLayer(k)} áreas carregadas.`;
      }
      if (done) {
        const db = getDb();
        await db.update(properties).set({ analyzedAt: null }).where(isNotNull(properties.geom));
      }
      return { done, note };
    }),
  "/admin");
}

export async function importLayer(formData: FormData) {
  return runAction("importLayer", () =>
    known(async () => {
      const file = formData.get("file");
      if (!(file instanceof File) || !file.size) throw new ActionError("Escolha um arquivo .geojson ou .json.");
      if (file.size > 12 * 1024 * 1024) throw new ActionError("Arquivo grande demais (máximo de 12 MB). Simplifique as geometrias antes de enviar.");
      const meta = parse(importMetaSchema, {
        title: formData.get("title"), category: formData.get("category"), source: formData.get("source"),
        sourceUrl: formData.get("sourceUrl") ?? "", sourceDate: formData.get("sourceDate") || undefined,
      });
      return importGeoJson(await file.text(), meta);
    }),
  "/admin");
}

export async function deleteLayer(key: string) {
  return runAction("deleteLayer", () => known(() => deleteImportedLayer(parse(z.string().max(120), key))), "/admin");
}

export async function loadDemo() {
  return runAction("loadDemo", () => known(async () => ({ count: await seedDemo() })), "/");
}

export async function removeDemoData() {
  return runAction("removeDemoData", async () => {
    await removeDemo();
    const db = getDb();
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(properties).where(eq(properties.isDemo, true));
    return { remaining: n };
  }, "/");
}
