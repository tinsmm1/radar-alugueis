import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { favoriteLists, favorites, listings, notifications, priceWatches, properties, savedSearches, sources } from "@/db/schema";
import type { NormalizedListing } from "@/domain/listing";
import { parseVrsync } from "@/domain/vrsync";

vi.mock("@/server/http", async (orig) => ({ ...(await orig<typeof import("@/server/http")>()), safeFetch: vi.fn() }));
const { ensureSeeded } = await import("@/server/settings");
const { storeListings } = await import("@/server/collect/source-run");
const { refreshOpportunities } = await import("@/server/collect/opportunities");
const { checkPriceTargets } = await import("@/server/notify/events");
const { telegramChunks } = await import("@/server/notify/deliver");
const { BUSY, withRunLock } = await import("@/server/run-lock");

const xml = readFileSync(new URL("../../src/domain/__fixtures__/feed-vrsync.xml", import.meta.url), "utf8");
const feed = parseVrsync(xml);
if (!feed.ok) throw new Error("fixture");
const day = 86_400_000;
const T0 = Date.parse("2026-11-01T09:00:00Z");
const one = (over: Partial<NormalizedListing>): NormalizedListing => ({ ...feed.listings[0], ...over });

async function source(key: string) {
  const db = getDb();
  await db.insert(sources).values({ key, adapter: "planilha", name: key, status: "ativa" }).onConflictDoNothing();
  return (await db.select().from(sources).where(eq(sources.key, key)))[0]!;
}
const propertyOf = async (externalId: string) => {
  const db = getDb();
  const [l] = await db.select().from(listings).where(eq(listings.externalId, externalId));
  return (await db.select().from(properties).where(eq(properties.id, l.propertyId!)))[0]!;
};

describe("follow-up, alerts and evaluation", () => {
  beforeAll(async () => {
    await ensureSeeded();
  });

  it("a later change of another cost does not erase a rent drop", async () => {
    const s = await source("p-drop");
    const base = one({ externalId: "K1", neighborhood: "Carmo", street: "Rua Grão Pará", number: "10", rentCents: 300_000, condoCents: 50_000 });
    await storeListings(s, [base], {}, { fullSnapshot: false, now: new Date(T0) });
    await storeListings(s, [{ ...base, rentCents: 270_000 }], {}, { fullSnapshot: false, now: new Date(T0 + day) });
    await storeListings(s, [{ ...base, rentCents: 270_000, condoCents: 52_000 }], {}, { fullSnapshot: false, now: new Date(T0 + 3 * day) });
    const p = await propertyOf("K1");
    expect(p.dropBp).toBe(1000);
    expect(p.droppedAt?.getTime()).toBe(T0 + day);
  });

  it("'novo' follows the mode: a rental that starts being sold reaches buy searches, not rent ones", async () => {
    const db = getDb();
    const s = await source("p-novo");
    const home = one({ externalId: "N1", neighborhood: "Gutierrez", street: "Rua Lavras", number: "5", rentCents: 280_000, purposes: ["aluguel"], salePriceCents: null });
    await storeListings(s, [home], {}, { fullSnapshot: false, now: new Date(T0) });
    await db.insert(savedSearches).values([{ name: "Gutierrez compra", query: "modo=compra&bairros=Gutierrez" }, { name: "Gutierrez aluguel", query: "bairros=Gutierrez" }]);
    await storeListings(s, [{ ...home, purposes: ["aluguel", "compra"], salePriceCents: 70_000_000 }], {}, { fullSnapshot: false, now: new Date(T0 + day) });
    const p = await propertyOf("N1");
    const notes = await db.select().from(notifications).where(and(eq(notifications.propertyId, p.id), eq(notifications.kind, "novo")));
    expect(notes.map((n) => (n.payload as { search: string }).search)).toEqual(["Gutierrez compra"]);
    // A second agency advertising the same home is not news for the rent search.
    const other = await source("p-novo-b");
    await storeListings(other, [{ ...home, externalId: "N1-B", rentCents: 279_000 }], {}, { fullSnapshot: false, now: new Date(T0 + 2 * day) });
    expect((await propertyOf("N1-B")).id).toBe(p.id);
    const after = await db.select().from(notifications).where(and(eq(notifications.propertyId, p.id), eq(notifications.kind, "novo")));
    expect(after).toHaveLength(1);
  });

  it("price target: notified once when reached, again only if it falls further; demo ignored", async () => {
    const db = getDb();
    const s = await source("p-alvo");
    const home = one({ externalId: "T1", neighborhood: "Sion", street: "Rua Califórnia", number: "77", purposes: ["compra"], rentCents: null, salePriceCents: 80_000_000 });
    await storeListings(s, [home], {}, { fullSnapshot: false, now: new Date(T0) });
    const p = await propertyOf("T1");
    await db.insert(priceWatches).values({ propertyId: p.id, mode: "compra", targetCents: 75_000_000, startPriceCents: 80_000_000 });
    expect(await checkPriceTargets()).toBe(0);
    await storeListings(s, [{ ...home, salePriceCents: 74_000_000 }], {}, { fullSnapshot: false, now: new Date(T0 + day) });
    expect(await checkPriceTargets()).toBe(0); // already raised by the ingestion itself
    const hits = await db.select().from(notifications).where(and(eq(notifications.propertyId, p.id), eq(notifications.kind, "preco_alvo")));
    expect(hits).toHaveLength(1);
    expect(hits[0].payload).toMatchObject({ mode: "compra", targetCents: 75_000_000, priceCents: 74_000_000 });
    // A followed property also gets its sale drops, tagged with the mode.
    const drops = await db.select().from(notifications).where(and(eq(notifications.propertyId, p.id), eq(notifications.kind, "baixa_preco")));
    expect(drops.map((d) => (d.payload as { mode: string }).mode)).toEqual(["compra"]);
    await storeListings(s, [{ ...home, salePriceCents: 72_000_000 }], {}, { fullSnapshot: false, now: new Date(T0 + 2 * day) });
    expect(await db.select().from(notifications).where(and(eq(notifications.propertyId, p.id), eq(notifications.kind, "preco_alvo")))).toHaveLength(2);
  });

  it("merging two properties moves favourites and watches without leaving a ghost", async () => {
    const db = getDb();
    const a = await source("p-merge-a");
    const b = await source("p-merge-b");
    const home = one({ externalId: "M1", neighborhood: "Anchieta", street: "Rua Itapeva", number: "300", rentCents: 320_000 });
    await storeListings(a, [home], {}, { fullSnapshot: false, now: new Date(T0) });
    // The same home first arrives without an address (not merged), then with it (merged).
    await storeListings(b, [{ ...home, externalId: "M2", street: null, number: null, lat: null, lng: null, title: "Outro título qualquer" }], {}, { fullSnapshot: false, now: new Date(T0) });
    const first = await propertyOf("M1");
    const second = await propertyOf("M2");
    expect(first.id).not.toBe(second.id);
    const [list] = await db.select().from(favoriteLists).limit(1);
    await db.insert(favorites).values({ listId: list.id, propertyId: second.id });
    await db.insert(priceWatches).values({ propertyId: second.id, mode: "aluguel", targetCents: 300_000 });
    await storeListings(b, [{ ...home, externalId: "M2" }], {}, { fullSnapshot: false, now: new Date(T0 + day) });
    const merged = await propertyOf("M2");
    expect(merged.id).toBe(first.id);
    expect(await db.select().from(properties).where(eq(properties.id, second.id))).toHaveLength(0);
    expect(await db.select().from(favorites).where(eq(favorites.propertyId, first.id))).toHaveLength(1);
    expect(await db.select().from(priceWatches).where(eq(priceWatches.propertyId, first.id))).toHaveLength(1);
  });

  it("evaluations are stored per mode with grade parts, pros and cons", async () => {
    const s = await source("p-eval");
    const homes = Array.from({ length: 8 }, (_, i) =>
      one({ externalId: `E${i}`, neighborhood: "Prado", street: `Rua Eval ${i}`, number: String(i + 1), bedrooms: 2, areaM2: 60, rentCents: 200_000 + i * 20_000, salePriceCents: 40_000_000 + i * 2_000_000, purposes: ["aluguel", "compra"], lat: -19.93 - i * 0.001, lng: -43.96 }),
    );
    await storeListings(s, homes, {}, { fullSnapshot: false, now: new Date(T0) });
    await refreshOpportunities(new Date(T0 + day));
    const cheap = await propertyOf("E0");
    const dear = await propertyOf("E7");
    expect(cheap.rentEvalScore).not.toBeNull();
    expect(cheap.saleEvalScore).not.toBeNull();
    expect(cheap.rentEvalScore!).toBeGreaterThan(dear.rentEvalScore!);
    const ev = cheap.rentEval as { grade: string; parts: Array<{ key: string }>; pros: string[] };
    expect(ev.parts.map((p) => p.key)).toEqual(["preco", "custos", "risco", "conveniencia", "imovel"]);
    expect(ev.pros.join(" ")).toMatch(/abaixo da mediana/);
    expect((dear.saleEval as { parts: Array<{ key: string }> }).parts.map((p) => p.key)).toContain("rendimento");
  });

  it("Telegram digests are split by whole items under the limit", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ id: i, kind: "novo" as const, title: `Imóvel ${i} & cia <b>`, detail: "x".repeat(140), url: `https://radar.example/imovel/${i}` }));
    const chunks = telegramChunks(items);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flatMap((c) => c.ids)).toEqual(items.map((i) => i.id));
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(3900);
      expect(c.text).not.toMatch(/<b>[^<]*$/);
    }
  });

  it("the run lock tells 'busy' apart from a step with nothing to do", async () => {
    const inner = await withRunLock("collect", async () => withRunLock("collect", async () => "ran"));
    // The inner call runs on another pooled connection, so the lock is held: busy.
    expect(inner).toBe(BUSY);
    expect(await withRunLock("collect", async () => null)).toBeNull();
  });
});
