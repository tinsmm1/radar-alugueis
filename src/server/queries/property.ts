import "server-only";
import { asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { cardColumns, type PropertyCard } from "../search";
import { getDb } from "@/db";
import { favorites, listings, possibleDuplicates, priceHistory, properties, sources } from "@/db/schema";
import type { LocationFacts } from "@/domain/risk";

export type PropertyRow = typeof properties.$inferSelect;
export type ListingRow = typeof listings.$inferSelect & { sourceKey: string; sourceName: string; sourceAdapter: string; sourceIsDemo: boolean };
export type PricePoint = { listingId: number; rentCents: number | null; condoCents: number | null; iptuCents: number | null; totalCents: number | null; salePriceCents?: number | null; observedAt: Date };
export type PossibleDuplicate = { listingId: number; otherListingId: number; otherPropertyId: number | null; score: number; title: string | null; neighborhood: string | null; rentCents: number | null; areaM2: number | null; sourceName: string };
export type FavoriteEntry = { listId: number; note: string | null };

export type PropertyDetail = {
  property: PropertyRow;
  facts: LocationFacts | null;
  listings: ListingRow[];
  history: PricePoint[];
  duplicates: PossibleDuplicate[];
  favoriteIn: FavoriteEntry[];
};

/** Everything the property page shows; null when the id does not exist. */
export async function getPropertyDetail(id: number): Promise<PropertyDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const db = getDb();
  const [property] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
  if (!property) return null;
  const rows = await db
    .select({ l: listings, sourceKey: sources.key, sourceName: sources.name, sourceAdapter: sources.adapter, sourceIsDemo: sources.isDemo })
    .from(listings)
    .innerJoin(sources, eq(sources.id, listings.sourceId))
    .where(eq(listings.propertyId, id))
    .orderBy(asc(listings.rentCents), asc(listings.id));
  const ls: ListingRow[] = rows.map((r) => ({ ...r.l, sourceKey: r.sourceKey, sourceName: r.sourceName, sourceAdapter: r.sourceAdapter, sourceIsDemo: r.sourceIsDemo }));
  const ids = ls.map((l) => l.id);
  const [history, dupRows, favs] = await Promise.all([
    ids.length
      ? db
          .select({ listingId: priceHistory.listingId, rentCents: priceHistory.rentCents, condoCents: priceHistory.condoCents, iptuCents: priceHistory.iptuCents, totalCents: priceHistory.totalCents, salePriceCents: priceHistory.salePriceCents, observedAt: priceHistory.observedAt })
          .from(priceHistory)
          .where(inArray(priceHistory.listingId, ids))
          .orderBy(asc(priceHistory.observedAt))
      : Promise.resolve([] as PricePoint[]),
    ids.length ? db.select().from(possibleDuplicates).where(or(inArray(possibleDuplicates.a, ids), inArray(possibleDuplicates.b, ids))).orderBy(desc(possibleDuplicates.score)).limit(10) : Promise.resolve([]),
    db.select({ listId: favorites.listId, note: favorites.note }).from(favorites).where(eq(favorites.propertyId, id)),
  ]);
  const own = new Set(ids);
  const otherIds = dupRows.map((d) => (own.has(d.a) ? d.b : d.a));
  const others = otherIds.length
    ? await db
        .select({ id: listings.id, propertyId: listings.propertyId, title: listings.title, neighborhood: listings.neighborhood, rentCents: listings.rentCents, areaM2: listings.areaM2, sourceName: sources.name })
        .from(listings)
        .innerJoin(sources, eq(sources.id, listings.sourceId))
        .where(inArray(listings.id, otherIds))
    : [];
  const byId = new Map(others.map((o) => [o.id, o]));
  const duplicates: PossibleDuplicate[] = dupRows
    .map((d) => {
      const mine = own.has(d.a) ? d.a : d.b;
      const other = byId.get(own.has(d.a) ? d.b : d.a);
      return other && other.propertyId !== id
        ? { listingId: mine, otherListingId: other.id, otherPropertyId: other.propertyId, score: d.score, title: other.title, neighborhood: other.neighborhood, rentCents: other.rentCents, areaM2: other.areaM2, sourceName: other.sourceName }
        : null;
    })
    .filter((x): x is PossibleDuplicate => Boolean(x));
  return { property, facts: (property.analysis as LocationFacts | null) ?? null, listings: ls, history, duplicates, favoriteIn: favs };
}

/** Lowest observed rent per day across the property's listings (for the history chart). */
export function dailyLowest(history: PricePoint[]): Array<{ at: Date; rentCents: number }> {
  const byDay = new Map<string, { at: Date; rentCents: number }>();
  const current = new Map<number, number>();
  for (const h of history) {
    if (h.rentCents == null) continue;
    current.set(h.listingId, h.rentCents);
    const day = h.observedAt.toISOString().slice(0, 10);
    byDay.set(day, { at: h.observedAt, rentCents: Math.min(...current.values()) });
  }
  return [...byDay.values()];
}

/** Ids of properties that exist (used by the comparator to drop stale ids). */
export async function existingIds(ids: number[]): Promise<number[]> {
  if (!ids.length) return [];
  const rows = await getDb().select({ id: properties.id }).from(properties).where(inArray(properties.id, ids));
  return rows.map((r) => r.id);
}

/**
 * Properties like this one in the same mode: same type and bedrooms ±1, same neighbourhood
 * first, then the same regional; best evaluated first. Demo data only matches demo data.
 */
export async function similarProperties(p: PropertyRow, mode: "aluguel" | "compra", limit = 6): Promise<PropertyCard[]> {
  if (!p.neighborhoodKey && !p.regional) return [];
  const pp = properties;
  const score = mode === "compra" ? pp.saleEvalScore : pp.rentEvalScore;
  const rows = await getDb()
    .select(cardColumns)
    .from(pp)
    .where(sql`${pp.id} <> ${p.id} and ${pp.status} = 'ativo' and ${pp.listingCount} > 0 and ${mode === "compra" ? pp.forSale : pp.forRent} and ${pp.isDemo} = ${p.isDemo}
      and (${pp.neighborhoodKey} = ${p.neighborhoodKey} or ${pp.regional} = ${p.regional})
      ${p.type ? sql`and ${pp.type} = ${p.type}` : sql``}
      ${p.bedrooms != null ? sql`and ${pp.bedrooms} between ${p.bedrooms - 1} and ${p.bedrooms + 1}` : sql``}`)
    .orderBy(sql`(${pp.neighborhoodKey} = ${p.neighborhoodKey}) desc`, sql`${score} desc nulls last`, asc(pp.id))
    .limit(limit);
  return rows as PropertyCard[];
}
