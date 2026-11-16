import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { readCollectFilters, type CollectFilters } from "@/domain/collect-filters";
import { normalizeText } from "@/domain/text";
import { ensureSeeded } from "./settings";

/** Owner's collection filters (default: every apartment and house in BH). */
export async function getCollectFilters(): Promise<CollectFilters> {
  await ensureSeeded();
  const [row] = await getDb().select({ f: settings.collectFilters }).from(settings).where(eq(settings.id, 1)).limit(1);
  return readCollectFilters(row?.f);
}

export async function saveCollectFilters(f: CollectFilters | null): Promise<void> {
  await ensureSeeded();
  await getDb().update(settings).set({ collectFilters: f, updatedAt: new Date() }).where(eq(settings.id, 1));
}

/** Normalized bairro name → regional, from the loaded neighbourhood layer (empty until layers load). */
export async function bairroRegionals(): Promise<(bairro: string) => string | null> {
  const rows = await getDb()
    .execute<{ name: string; regional: string }>(sql`select name, regional from areas where kind = 'bairro' and regional is not null`)
    .then((r) => r.rows);
  const map = new Map(rows.map((r) => [normalizeText(r.name), r.regional]));
  return (bairro) => map.get(bairro) ?? null;
}
