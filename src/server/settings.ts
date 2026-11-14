import "server-only";
import { cache } from "react";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { favoriteLists, settings } from "@/db/schema";
import { ensureSources } from "./sources/registry";

let seeded = false;

/** Settings row, default favourite list and the source registry exist (idempotent, once per instance). */
export async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  const db = getDb();
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [lists] = await db.select({ n: sql<number>`count(*)::int` }).from(favoriteLists);
  if (!lists?.n) await db.insert(favoriteLists).values({ name: "Favoritos" });
  await ensureSources();
  seeded = true;
}

export const getSettings = cache(async () => {
  await ensureSeeded();
  const [row] = await getDb().select().from(settings).where(eq(settings.id, 1)).limit(1);
  return row!;
});
