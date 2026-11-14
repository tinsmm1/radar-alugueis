import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { favorites, notifications, properties, savedSearches } from "@/db/schema";
import { describeFilter, filterFromParams } from "@/domain/filters";
import { cardColumns, searchProperties, type PropertyCard } from "../search";
import { getSettings } from "../settings";

export type FavoriteItem = { card: PropertyCard; note: string | null; addedAt: Date };

/** Items of one favourite list, newest first. */
export async function favoriteItems(listId: number): Promise<FavoriteItem[]> {
  const rows = await getDb()
    .select({ card: cardColumns, note: favorites.note, addedAt: favorites.createdAt })
    .from(favorites)
    .innerJoin(properties, eq(properties.id, favorites.propertyId))
    .where(eq(favorites.listId, listId))
    .orderBy(desc(favorites.createdAt));
  return rows.map((r) => ({ card: r.card as PropertyCard, note: r.note, addedAt: r.addedAt }));
}

/** A price drop still worth showing (last 30 days), else null. */
export function recentDrop(bp: number | null, at: Date | null): number | null {
  return bp && at && Date.now() - at.getTime() <= 30 * 86_400_000 ? bp : null;
}

/** Favourites (any list) that dropped in price in 30 days or are no longer available. */
export async function favoriteChanges(): Promise<PropertyCard[]> {
  const rows = await getDb()
    .selectDistinct(cardColumns)
    .from(properties)
    .innerJoin(favorites, eq(favorites.propertyId, properties.id))
    .where(sql`(${properties.dropBp} > 0 and ${properties.droppedAt} >= now() - interval '30 days') or (${properties.saleDropBp} > 0 and ${properties.saleDroppedAt} >= now() - interval '30 days') or ${properties.status} <> 'ativo'`)
    .limit(24);
  return rows as PropertyCard[];
}

export type SavedSearchView = { id: number; name: string; query: string; description: string; notifyNew: boolean; notifyDrop: boolean; createdAt: Date; matches: number; new24h: number };

export async function savedSearchViews(): Promise<SavedSearchView[]> {
  const rows = await getDb().select().from(savedSearches).orderBy(asc(savedSearches.createdAt));
  return Promise.all(
    rows.map(async (s) => {
      const f = filterFromParams(new URLSearchParams(s.query));
      const { stats } = await searchProperties(f, 1);
      return { id: s.id, name: s.name, query: s.query, description: describeFilter(f), notifyNew: s.notifyNew, notifyDrop: s.notifyDrop, createdAt: s.createdAt, matches: stats.total, new24h: stats.new24h };
    }),
  );
}

export type NotificationView = {
  id: number;
  kind: string;
  createdAt: Date;
  emailedAt: Date | null;
  telegramAt: Date | null;
  propertyId: number | null;
  title: string | null;
  neighborhood: string | null;
  totalCents: number | null;
  rentCents: number | null;
  salePriceCents: number | null;
  isDemo: boolean | null;
  payload: { search?: string; mode?: "aluguel" | "compra"; dropBp?: number | null; targetCents?: number; priceCents?: number; source?: string; error?: string; favorite?: boolean } | null;
  unread: boolean;
};

export async function notificationViews(limit = 100): Promise<NotificationView[]> {
  const seenAt = (await getSettings()).notificationsSeenAt;
  const rows = await getDb()
    .select({ n: notifications, title: properties.title, neighborhood: properties.neighborhood, totalCents: properties.totalCents, rentCents: properties.rentCents, salePriceCents: properties.salePriceCents, isDemo: properties.isDemo })
    .from(notifications)
    .leftJoin(properties, eq(properties.id, notifications.propertyId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.n.id, kind: r.n.kind, createdAt: r.n.createdAt, emailedAt: r.n.emailedAt, telegramAt: r.n.telegramAt, propertyId: r.n.propertyId,
    title: r.title, neighborhood: r.neighborhood, totalCents: r.totalCents, rentCents: r.rentCents, salePriceCents: r.salePriceCents, isDemo: r.isDemo, payload: r.n.payload as NotificationView["payload"],
    unread: !seenAt || r.n.createdAt > seenAt,
  }));
}

/** Favourite membership per property id (for list counts). */
export async function favoriteListIds(ids: number[]): Promise<Map<number, number[]>> {
  if (!ids.length) return new Map();
  const rows = await getDb().select({ pid: favorites.propertyId, lid: favorites.listId }).from(favorites).where(and(inArray(favorites.propertyId, ids)));
  const out = new Map<number, number[]>();
  for (const r of rows) out.set(r.pid, [...(out.get(r.pid) ?? []), r.lid]);
  return out;
}
