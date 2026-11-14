import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { sourceRuns, sources } from "@/db/schema";
import type { NormalizedListing } from "@/domain/listing";
import { logger } from "@/lib/logger";
import { checkPriceTargets, notificationsFor, sourceFailed } from "../notify/events";
import { ADAPTERS, SkipSource, type SourceRow } from "../sources/registry";
import { ingest, type IngestStats } from "./ingest";
import { regroup } from "./properties";

const MAX_ATTEMPTS = 3;

/** Ingests listings for a source, regroups duplicates and records events (uploads, demo, feeds). */
export async function storeListings(source: SourceRow, listings: NormalizedListing[], raws: Record<string, unknown>, opts: { fullSnapshot: boolean; now?: Date }): Promise<IngestStats & { duplicates: number }> {
  const { stats, events } = await ingest(source.id, listings, raws, { fullSnapshot: opts.fullSnapshot, isDemo: source.isDemo, now: opts.now });
  const regrouped = await regroup(stats.touched);
  if (!source.isDemo) {
    await notificationsFor(events, regrouped.opened);
    await checkPriceTargets();
  }
  const [dup] = await getDb().execute<{ n: number }>(sql`select count(*)::int as n from listings where source_id = ${source.id} and property_id in (select property_id from listings group by property_id having count(*) > 1)`).then((r) => r.rows);
  return { ...stats, duplicates: dup?.n ?? 0, touched: regrouped.ids };
}

/**
 * Collects one scheduled source with retries (backoff 2 s, 6 s). A failure is recorded on the
 * source and in source_runs, raises a "fonte_falhou" notification and never stops other sources.
 */
export async function collectSource(source: SourceRow, runId: number | null): Promise<{ status: "ok" | "partial" | "failed" | "skipped"; error?: string }> {
  const db = getDb();
  const adapter = ADAPTERS[source.adapter];
  const started = Date.now();
  if (!adapter?.collect) return { status: "skipped" };
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const collected = await adapter.collect(source);
      const s = await storeListings(source, collected.listings, collected.raws, { fullSnapshot: collected.fullSnapshot });
      const status = s.partial ? "partial" : "ok";
      await db.insert(sourceRuns).values({ runId, sourceId: source.id, status, attempt, fetched: s.fetched, created: s.created, updated: s.updated, priceChanges: s.priceChanges, duplicates: s.duplicates, missing: s.missing, skipped: Object.values(collected.skipped).reduce((a, b) => a + b, 0), durationMs: Date.now() - started, error: s.partial ? "Feed com menos da metade dos anúncios: ausências não foram marcadas." : null });
      return { status };
    } catch (err) {
      if (err instanceof SkipSource) {
        await db.insert(sourceRuns).values({ runId, sourceId: source.id, status: "skipped", attempt, error: err.message, durationMs: Date.now() - started });
        await db.update(sources).set({ lastRunAt: new Date() }).where(eq(sources.id, source.id));
        return { status: "skipped", error: err.message };
      }
      lastError = (err as Error).message?.slice(0, 300) || "erro desconhecido";
      logger.warn({ source: source.key, attempt, msg: lastError }, "source collection failed");
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, attempt * attempt * 2_000));
    }
  }
  await db.insert(sourceRuns).values({ runId, sourceId: source.id, status: "failed", attempt: MAX_ATTEMPTS, error: lastError, durationMs: Date.now() - started });
  await db.update(sources).set({ lastRunAt: new Date(), lastError, consecutiveFailures: sql`${sources.consecutiveFailures} + 1` }).where(eq(sources.id, source.id));
  await sourceFailed(source.name, lastError);
  return { status: "failed", error: lastError };
}
