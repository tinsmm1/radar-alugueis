import "server-only";
import { desc, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { collectionRuns, listings } from "@/db/schema";

export type UpdateInfo = {
  /** End of the last finished collection run. */
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  /** Most recent check of any listing (uploads and manual entries included). */
  lastCheckedAt: Date | null;
  /** Next scheduled run (06:00 or 18:00, America/Sao_Paulo). */
  nextRunAt: Date;
};

/** Next 06:00 or 18:00 in São Paulo (UTC−3 all year since 2019) after `now`. */
export function nextScheduledRun(now = new Date()): Date {
  const offsetMs = 3 * 3_600_000;
  const local = new Date(now.getTime() - offsetMs);
  const candidates = [6, 18, 30].map((h) => Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h) + offsetMs);
  return new Date(candidates.find((t) => t > now.getTime())!);
}

export async function updateInfo(): Promise<UpdateInfo> {
  const db = getDb();
  const [[run], [checked]] = await Promise.all([
    db.select({ at: collectionRuns.finishedAt, status: collectionRuns.status }).from(collectionRuns).where(inArray(collectionRuns.status, ["ok", "partial", "failed"])).orderBy(desc(collectionRuns.finishedAt)).limit(1),
    db.select({ at: sql<Date | null>`max(${listings.lastCheckedAt})` }).from(listings),
  ]);
  return { lastRunAt: run?.at ?? null, lastRunStatus: run?.status ?? null, lastCheckedAt: checked?.at ? new Date(checked.at) : null, nextRunAt: nextScheduledRun() };
}
