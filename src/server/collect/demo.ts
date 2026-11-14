import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { sourceRuns, sources } from "@/db/schema";
import { demoDuplicate, demoListings, type DemoArea } from "@/domain/demo";
import { refreshOpportunities } from "./opportunities";
import { purgeSource } from "./ingest";
import { refreshProperties } from "./properties";
import { storeListings as store } from "./source-run";

type Store = typeof store;

/** Demo snapshots are recorded like any collection, so the admin panel shows their counts. */
const storeListings: Store = async (source, items, raws, opts) => {
  const started = Date.now();
  const s = await store(source, items, raws, opts);
  await getDb().insert(sourceRuns).values({ sourceId: source.id, status: s.partial ? "partial" : "ok", fetched: s.fetched, created: s.created, updated: s.updated, priceChanges: s.priceChanges, duplicates: s.duplicates, missing: s.missing, durationMs: Date.now() - started, startedAt: opts.now ?? new Date() });
  return s;
};

export class DemoError extends Error {}

async function demoSource(key: string, name: string) {
  const db = getDb();
  await db.insert(sources).values({ key, adapter: "demo", name, status: "ativa", isDemo: true }).onConflictDoNothing({ target: sources.key });
  const [s] = await db.select().from(sources).where(eq(sources.key, key));
  return s!;
}

/**
 * Loads clearly-flagged demonstration data on real neighbourhood centres: two demo "sources"
 * (to show deduplication), three snapshots over 10 days (history, price drops, new listings,
 * one listing that disappears). Needs the OSM layer (neighbourhood points) loaded.
 */
export async function seedDemo(count = 260): Promise<number> {
  const db = getDb();
  const { rows } = await db.execute<DemoArea>(sql`
    select name, ST_Y(geom) as lat, ST_X(geom) as lng, regional from areas
    where kind = 'bairro' and ST_GeometryType(geom) = 'ST_Point' and regional is not null order by name_key`);
  if (rows.length < 20) throw new DemoError("Carregue antes as camadas do OpenStreetMap (bairros) em Administração → Camadas.");
  const areas = rows.map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) }));
  const a = await demoSource("demo", "Demonstração A");
  const b = await demoSource("demo-b", "Demonstração B");
  const base = demoListings(areas, count);
  const day = 86_400_000;
  const now = Date.now();
  const first = base.slice(0, count - 12);
  await storeListings(a, first, {}, { fullSnapshot: true, now: new Date(now - 10 * day) });
  // Day 7: some prices drop, one listing disappears; source B announces some of the same homes.
  const second = first
    .filter((_, i) => i !== 3)
    .map((l, i) => (i % 9 === 0 ? { ...l, rentCents: l.rentCents && Math.round((l.rentCents * 0.9) / 5000) * 5000, salePriceCents: l.salePriceCents && Math.round((l.salePriceCents * 0.93) / 500_000) * 500_000 } : l));
  await storeListings(a, second, {}, { fullSnapshot: true, now: new Date(now - 3 * day) });
  await storeListings(b, first.filter((_, i) => i % 11 === 0).map((l) => demoDuplicate(l, -5_000)), {}, { fullSnapshot: true, now: new Date(now - 3 * day) });
  // Today: new listings appear.
  await storeListings(a, [...second, ...base.slice(count - 12)], {}, { fullSnapshot: true, now: new Date(now - 2 * 3_600_000) });
  await refreshOpportunities();
  return count;
}

/** Removes every demo source, listing and property (real data is untouched). */
export async function removeDemo(): Promise<void> {
  const db = getDb();
  const demo = await db.select().from(sources).where(eq(sources.isDemo, true));
  for (const s of demo) {
    const touched = await purgeSource(s.id);
    await refreshProperties(touched);
    await db.delete(sources).where(eq(sources.id, s.id));
  }
  await db.execute(sql`delete from properties p where p.is_demo and not exists (select 1 from listings l where l.property_id = p.id)`);
}
