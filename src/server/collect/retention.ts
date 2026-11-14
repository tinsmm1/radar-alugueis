import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

/** Retention policy (documented in docs/security.md). */
export const RETENTION = {
  /** Raw payloads: the latest per listing is kept forever; older versions for 90 days. */
  rawDays: 90,
  /** Collection and source run logs. */
  runDays: 180,
  /** Notifications. */
  notificationDays: 365,
  /** Unavailable listings with no favourite: removed after a year (history goes with them). */
  unavailableDays: 365,
} as const;

export async function applyRetention(): Promise<Record<string, number>> {
  const db = getDb();
  const count = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rowCount ?? 0;
  return {
    raw: await count(sql`delete from listings_raw r where r.fetched_at < now() - make_interval(days => ${RETENTION.rawDays}) and not exists (select 1 from listings l where l.raw_id = r.id)`),
    runs: await count(sql`delete from collection_runs where started_at < now() - make_interval(days => ${RETENTION.runDays})`),
    sourceRuns: await count(sql`delete from source_runs where started_at < now() - make_interval(days => ${RETENTION.runDays})`),
    notifications: await count(sql`delete from notifications where created_at < now() - make_interval(days => ${RETENTION.notificationDays})`),
    unavailable: await count(sql`delete from listings l where l.status = 'indisponivel' and l.last_seen_at < now() - make_interval(days => ${RETENTION.unavailableDays}) and not exists (select 1 from favorites f where f.property_id = l.property_id)`),
    orphanProperties: await count(sql`delete from properties p where not exists (select 1 from listings l where l.property_id = p.id) and not exists (select 1 from favorites f where f.property_id = p.id)`),
    rateLimits: await count(sql`delete from rate_limits where window_start < now() - interval '1 day'`),
  };
}
