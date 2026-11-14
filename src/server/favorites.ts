import "server-only";
import { asc, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { favoriteLists, favorites } from "@/db/schema";

/** Which of these properties are in any favourite list. */
export async function favoriteIds(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const rows = await getDb().selectDistinct({ id: favorites.propertyId }).from(favorites).where(inArray(favorites.propertyId, ids));
  return new Set(rows.map((r) => r.id));
}

export async function lists(): Promise<Array<{ id: number; name: string; count: number }>> {
  return getDb()
    .select({ id: favoriteLists.id, name: favoriteLists.name, count: sql<number>`(select count(*)::int from favorites f where f.list_id = ${favoriteLists.id})` })
    .from(favoriteLists)
    .orderBy(asc(favoriteLists.id));
}
