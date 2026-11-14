import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { priceWatches, properties } from "@/db/schema";
import { cardColumns, type PropertyCard } from "../search";

export type Watch = { mode: "aluguel" | "compra"; targetCents: number | null; startPriceCents: number | null; notifiedAt: Date | null; createdAt: Date };
export type WatchItem = Watch & { card: PropertyCard; currentCents: number | null };

const toWatch = (w: typeof priceWatches.$inferSelect): Watch => ({ mode: w.mode as Watch["mode"], targetCents: w.targetCents, startPriceCents: w.startPriceCents, notifiedAt: w.notifiedAt, createdAt: w.createdAt });

export async function watchesFor(propertyId: number): Promise<Watch[]> {
  const rows = await getDb().select().from(priceWatches).where(eq(priceWatches.propertyId, propertyId)).orderBy(asc(priceWatches.mode));
  return rows.map(toWatch);
}

/** Every followed price with its property and the current price of that mode. */
export async function allWatches(): Promise<WatchItem[]> {
  const rows = await getDb().select({ w: priceWatches, card: cardColumns }).from(priceWatches).innerJoin(properties, eq(properties.id, priceWatches.propertyId)).orderBy(desc(priceWatches.createdAt));
  return rows.map((r) => {
    const card = r.card as PropertyCard;
    const w = toWatch(r.w);
    return { ...w, card, currentCents: w.mode === "compra" ? card.salePriceCents : (card.totalCents ?? card.rentCents) };
  });
}
