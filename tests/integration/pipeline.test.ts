import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { favorites, favoriteLists, layers, listings, listingsRaw, notifications, priceHistory, properties, savedSearches, sourceRuns, sources } from "@/db/schema";
import type { NormalizedListing } from "@/domain/listing";
import { parseVrsync } from "@/domain/vrsync";

vi.mock("@/server/http", async (orig) => ({ ...(await orig<typeof import("@/server/http")>()), safeFetch: vi.fn() }));
const http = await import("@/server/http");
const { ensureSeeded } = await import("@/server/settings");
const { storeListings, collectSource } = await import("@/server/collect/source-run");
const { runStep } = await import("@/server/collect/run");

const xml = readFileSync(new URL("../../src/domain/__fixtures__/feed-vrsync.xml", import.meta.url), "utf8");
const feed = parseVrsync(xml);
if (!feed.ok) throw new Error("fixture");
const day = 86_400_000;
const T0 = Date.parse("2026-11-01T09:00:00Z");

async function source(key: string, adapter = "vrsync", url: string | null = "https://feeds.example.com/vrsync.xml") {
  const db = getDb();
  await db.insert(sources).values({ key, adapter, name: key, url, status: "ativa" }).onConflictDoNothing();
  return (await db.select().from(sources).where(eq(sources.key, key)))[0]!;
}

const one = (over: Partial<NormalizedListing>): NormalizedListing => ({ ...feed.listings[0], ...over });

describe("collection pipeline", () => {
  beforeAll(async () => {
    await ensureSeeded();
    // Layers count as fresh, so runStep does not download them.
    for (const key of ["sgb_inundacao", "sgb_movimento_massa", "sgb_enxurrada", "sgb_risco_geologico", "regionais", "osm"]) {
      await getDb().insert(layers).values({ key, title: key, category: "suscetibilidade", source: "teste", status: "ok", refreshedAt: new Date() }).onConflictDoNothing();
    }
  });

  it("feed → raw (scrubbed) + normalized listing + property with known cost", async () => {
    const s = await source("feed-a");
    vi.mocked(http.safeFetch).mockResolvedValueOnce({ url: s.url!, status: 200, contentType: "application/xml", body: Buffer.from(xml) });
    expect(await collectSource(s, null)).toEqual({ status: "ok" });
    const db = getDb();
    const ls = await db.select().from(listings).where(eq(listings.sourceId, s.id));
    expect(ls.map((l) => l.externalId).sort()).toEqual(["AP-101", "CA-7", "V-1"]);
    const raws = await db.select().from(listingsRaw).where(eq(listingsRaw.sourceId, s.id));
    expect(JSON.stringify(raws)).not.toMatch(/99999|corretor@/);
    const ap = ls.find((l) => l.externalId === "AP-101")!;
    const [prop] = await db.select().from(properties).where(eq(properties.id, ap.propertyId!));
    // 3.500 + 780,50 + 2.400/12 = 4.480,50
    expect(prop).toMatchObject({ rentCents: 350_000, condoCents: 78_050, iptuMonthlyCents: 20_000, totalCents: 448_050, costStatus: "completo", geoPrecision: "exata", neighborhood: "Savassi" });
    expect(prop.costPerM2Cents).toBe(Math.round(448_050 / 92));
    const ca = ls.find((l) => l.externalId === "CA-7")!;
    const [house] = await db.select().from(properties).where(eq(properties.id, ca.propertyId!));
    expect(house).toMatchObject({ costStatus: "parcial", condoCents: null, geom: null, forRent: true, forSale: true, salePriceCents: 90_000_000, salePriceM2Cents: 500_000 });
    const v1 = ls.find((l) => l.externalId === "V-1")!;
    expect(v1).toMatchObject({ purposes: ["compra"], rentCents: null, salePriceCents: 50_000_000 });
    const [sale] = await db.select().from(properties).where(eq(properties.id, v1.propertyId!));
    expect(sale).toMatchObject({ forRent: false, forSale: true, salePriceCents: 50_000_000, rentCents: null, totalCents: null });
    const [run] = await db.select().from(sourceRuns).where(eq(sourceRuns.sourceId, s.id));
    expect(run).toMatchObject({ status: "ok", fetched: 3, created: 3, skipped: 2 });
  });

  it("price drop → history, drop %, notifications for saved search and favourite", async () => {
    const db = getDb();
    const s = await source("planilha-t", "planilha", null);
    const base = one({ externalId: "X1", neighborhood: "Lourdes", street: "Rua Curitiba", number: "50", lat: -19.93, lng: -43.945, rentCents: 400_000 });
    await storeListings(s, [base], {}, { fullSnapshot: true, now: new Date(T0) });
    const [l] = await db.select().from(listings).where(eq(listings.externalId, "X1"));
    await db.insert(savedSearches).values({ name: "Lourdes até 5 mil", query: "bairros=Lourdes&totalMax=5000" });
    const [list] = await db.select().from(favoriteLists).limit(1);
    await db.insert(favorites).values({ listId: list.id, propertyId: l.propertyId! });
    await storeListings(s, [{ ...base, rentCents: 360_000 }], {}, { fullSnapshot: true, now: new Date(T0 + day) });
    const hist = await db.select().from(priceHistory).where(eq(priceHistory.listingId, l.id));
    expect(hist.map((h) => h.rentCents)).toEqual([400_000, 360_000]);
    const [p] = await db.select().from(properties).where(eq(properties.id, l.propertyId!));
    expect(p).toMatchObject({ rentCents: 360_000, initialRentCents: 400_000, dropBp: 1000 });
    const notes = await db.select().from(notifications).where(eq(notifications.propertyId, p.id));
    expect(notes.map((n) => n.kind).sort()).toEqual(["baixa_preco", "baixa_preco"]);
  });

  it("missing listings: possibly unavailable, then unavailable; truncated feeds mark nothing", async () => {
    const db = getDb();
    const s = await source("feed-life");
    const items = Array.from({ length: 24 }, (_, i) => one({ externalId: `L${i}`, number: String(100 + i), neighborhood: `Bairro ${i}`, lat: null, lng: null }));
    await storeListings(s, items, {}, { fullSnapshot: true, now: new Date(T0) });
    // Truncated snapshot (2 of 24): no listing is marked.
    const cut = await storeListings(s, items.slice(0, 2), {}, { fullSnapshot: true, now: new Date(T0 + day) });
    expect(cut.partial).toBe(true);
    expect((await db.select().from(listings).where(sql`${listings.sourceId} = ${s.id} and ${listings.status} <> 'ativo'`)).length).toBe(0);
    await storeListings(s, items.slice(1), {}, { fullSnapshot: true, now: new Date(T0 + 2 * day) });
    expect((await db.select().from(listings).where(eq(listings.externalId, "L0")))[0].status).toBe("possivelmente_indisponivel");
    await storeListings(s, items.slice(1), {}, { fullSnapshot: true, now: new Date(T0 + 4 * day) });
    const [gone] = await db.select().from(listings).where(eq(listings.externalId, "L0"));
    expect(gone.status).toBe("indisponivel");
    expect((await db.select().from(properties).where(eq(properties.id, gone.propertyId!)))[0].status).toBe("indisponivel");
    // It comes back.
    await storeListings(s, items, {}, { fullSnapshot: true, now: new Date(T0 + 5 * day) });
    expect((await db.select().from(listings).where(eq(listings.externalId, "L0")))[0]).toMatchObject({ status: "ativo", missingCount: 0 });
  });

  it("sale price drops are recorded and notify buy searches only", async () => {
    const db = getDb();
    const s = await source("planilha-venda", "planilha", null);
    const home = one({ externalId: "S1", purposes: ["compra"], rentCents: null, salePriceCents: 60_000_000, neighborhood: "Serra", street: "Rua do Ouro", number: "9", lat: -19.94, lng: -43.92 });
    await storeListings(s, [home], {}, { fullSnapshot: true, now: new Date(T0) });
    await db.insert(savedSearches).values([{ name: "Serra compra", query: "modo=compra&bairros=Serra" }, { name: "Serra aluguel", query: "bairros=Serra" }]);
    await storeListings(s, [{ ...home, salePriceCents: 55_000_000 }], {}, { fullSnapshot: true, now: new Date(T0 + day) });
    const [l] = await db.select().from(listings).where(eq(listings.externalId, "S1"));
    const [p] = await db.select().from(properties).where(eq(properties.id, l.propertyId!));
    expect(p).toMatchObject({ forSale: true, salePriceCents: 55_000_000, initialSalePriceCents: 60_000_000, saleDropBp: 833, dropBp: null });
    const notes = await db.select().from(notifications).where(eq(notifications.propertyId, p.id));
    expect(notes.map((n) => (n.payload as { search?: string }).search)).toEqual(["Serra compra"]);
  });

  it("the same home in two sources is one property with both links and the lowest price", async () => {
    const db = getDb();
    const a = await source("feed-dup-a");
    const b = await source("feed-dup-b");
    const home = one({ externalId: "D1", neighborhood: "Sion", street: "Rua Grão Mogol", number: "300", lat: -19.951, lng: -43.938, rentCents: 300_000 });
    await storeListings(a, [home], {}, { fullSnapshot: true });
    await storeListings(b, [{ ...home, externalId: "Z-9", street: "R. Grão Mogol", rentCents: 290_000, title: "Apto 3 quartos com suíte e varanda no Sion" }], {}, { fullSnapshot: true });
    const rows = await db.select({ pid: listings.propertyId }).from(listings).where(sql`${listings.externalId} in ('D1', 'Z-9')`);
    expect(new Set(rows.map((r) => r.pid)).size).toBe(1);
    const [p] = await db.select().from(properties).where(eq(properties.id, rows[0].pid!));
    expect(p).toMatchObject({ listingCount: 2, rentCents: 290_000 });
    expect(p.sourceKeys.sort()).toEqual(["feed-dup-a", "feed-dup-b"]);
  });

  it("a failing source is retried, recorded and notified; the run goes on and ends partial", async () => {
    const db = getDb();
    await db.update(sources).set({ status: "pausada" }).where(sql`${sources.adapter} = 'vrsync'`);
    const ok = await source("feed-ok");
    const bad = await source("feed-bad", "vrsync", "https://broken.example.com/x.xml");
    await db.update(sources).set({ status: "ativa" }).where(sql`${sources.id} in (${ok.id}, ${bad.id})`);
    vi.mocked(http.safeFetch).mockImplementation(async (url) => {
      if (String(url).includes("broken")) return { url: String(url), status: 500, contentType: "text/html", body: Buffer.from("erro") };
      return { url: String(url), status: 200, contentType: "application/xml", body: Buffer.from(xml) };
    });
    let r = await runStep("manual", 55_000);
    while (r?.more) r = await runStep("manual", 55_000);
    expect(r?.stage).toBe("concluido");
    const runs = await db.select().from(sourceRuns).where(eq(sourceRuns.runId, r!.runId));
    expect(runs.find((x) => x.sourceId === bad.id)).toMatchObject({ status: "failed", attempt: 3 });
    expect(runs.find((x) => x.sourceId === ok.id)?.status).toBe("ok");
    expect(runs.filter((x) => x.status === "skipped").length).toBe(7);
    const [badRow] = await db.select().from(sources).where(eq(sources.id, bad.id));
    expect(badRow.consecutiveFailures).toBe(1);
    expect(await db.select().from(notifications).where(eq(notifications.kind, "fonte_falhou"))).toHaveLength(1);
    const { rows } = await db.execute<{ status: string }>(sql`select status from collection_runs where id = ${r!.runId}`);
    expect(rows[0].status).toBe("partial");
  }, 120_000);
});
