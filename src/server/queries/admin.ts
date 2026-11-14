import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { collectionRuns, layers, sourceRuns, sources } from "@/db/schema";
import { invalidEnv, optionalEnv } from "@/lib/env";
import { locationStats } from "../geo/geocode";
import { channels } from "../notify/deliver";
import type { Assessment } from "../sources/assessments";
import { ADAPTERS } from "../sources/registry";
import { getSettings } from "../settings";

export type RunRow = typeof collectionRuns.$inferSelect;
export type SourceRunRow = typeof sourceRuns.$inferSelect & { sourceName: string };

const SP_TZ = "America/Sao_Paulo";

/** Next scheduled runs (06:00 and 18:00 in São Paulo, which has no DST since 2019: UTC−3). */
export function nextScheduledRuns(now = new Date(), count = 2): Date[] {
  const out: Date[] = [];
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let d = 0; out.length < count && d < 3; d++) {
    for (const hourLocal of [6, 18]) {
      const t = new Date(day.getTime() + d * 86_400_000 + (hourLocal + 3) * 3_600_000);
      if (t > now && out.length < count) out.push(t);
    }
  }
  return out;
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: SP_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

export async function overview() {
  const db = getDb();
  const [last] = await db.select().from(collectionRuns).orderBy(desc(collectionRuns.startedAt)).limit(1);
  const [lastOk] = await db.select().from(collectionRuns).where(inArray(collectionRuns.status, ["ok", "partial"])).orderBy(desc(collectionRuns.startedAt)).limit(1);
  const [counts] = await db.execute<{ properties: number; active: number; listings: number; demo: number; failing: number }>(sql`
    select
      (select count(*)::int from properties where listing_count > 0) as properties,
      (select count(*)::int from properties where listing_count > 0 and status = 'ativo') as active,
      (select count(*)::int from listings) as listings,
      (select count(*)::int from listings where is_demo) as demo,
      (select count(*)::int from sources where consecutive_failures > 0) as failing`).then((r) => r.rows);
  const ch = await channels();
  const settings = await getSettings();
  return {
    last: last ?? null,
    lastOk: lastOk ?? null,
    next: nextScheduledRuns(),
    invalid: invalidEnv(),
    counts: counts ?? { properties: 0, active: 0, listings: 0, demo: 0, failing: 0 },
    location: await locationStats(),
    channels: ch,
    env: {
      cronSecret: Boolean(optionalEnv("CRON_SECRET")),
      email: Boolean(optionalEnv("RESEND_API_KEY") || optionalEnv("SMTP_URL")),
      telegram: Boolean(optionalEnv("TELEGRAM_BOT_TOKEN")),
      notifyEmail: settings.notifyEmail ?? optionalEnv("NOTIFY_EMAIL") ?? null,
    },
  };
}

export type SourceView = {
  id: number;
  key: string;
  name: string;
  adapter: string;
  adapterLabel: string;
  url: string | null;
  status: string;
  authorization: string | null;
  assessment: Assessment | null;
  isDemo: boolean;
  lastRunAt: Date | null;
  lastOkAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
  listings: number;
  active: number;
  latest: typeof sourceRuns.$inferSelect | null;
};

export async function sourcesOverview(): Promise<SourceView[]> {
  const db = getDb();
  const rows = await db.select().from(sources).orderBy(sources.adapter, sources.name);
  const counts = await db.execute<{ source_id: number; total: number; active: number }>(sql`select source_id, count(*)::int as total, count(*) filter (where status = 'ativo')::int as active from listings group by source_id`);
  const byId = new Map(counts.rows.map((r) => [Number(r.source_id), r]));
  const latest = await db.execute<{ id: number }>(sql`select distinct on (source_id) id from source_runs order by source_id, started_at desc`);
  const latestRows = latest.rows.length ? await db.select().from(sourceRuns).where(inArray(sourceRuns.id, latest.rows.map((r) => Number(r.id)))) : [];
  const latestBy = new Map(latestRows.map((r) => [r.sourceId, r]));
  return rows.map((s) => ({
    id: s.id, key: s.key, name: s.name, adapter: s.adapter, adapterLabel: ADAPTERS[s.adapter]?.label ?? s.adapter, url: s.url, status: s.status,
    authorization: s.authorization, assessment: (s.assessment as Assessment | null) ?? null, isDemo: s.isDemo, lastRunAt: s.lastRunAt, lastOkAt: s.lastOkAt,
    lastError: s.lastError, consecutiveFailures: s.consecutiveFailures, listings: byId.get(s.id)?.total ?? 0, active: byId.get(s.id)?.active ?? 0, latest: latestBy.get(s.id) ?? null,
  }));
}

export async function runsHistory(limit = 30): Promise<Array<RunRow & { sources: SourceRunRow[] }>> {
  const db = getDb();
  const runs = await db.select().from(collectionRuns).orderBy(desc(collectionRuns.startedAt)).limit(limit);
  if (!runs.length) return [];
  const per = await db
    .select({ r: sourceRuns, sourceName: sources.name })
    .from(sourceRuns)
    .innerJoin(sources, eq(sources.id, sourceRuns.sourceId))
    .where(inArray(sourceRuns.runId, runs.map((r) => r.id)))
    .orderBy(sourceRuns.id);
  return runs.map((run) => ({ ...run, sources: per.filter((p) => p.r.runId === run.id).map((p) => ({ ...p.r, sourceName: p.sourceName })) }));
}

/** Uploads and manual entries are not part of runs: their latest source_runs rows. */
export async function uploadHistory(limit = 15): Promise<SourceRunRow[]> {
  const rows = await getDb()
    .select({ r: sourceRuns, sourceName: sources.name })
    .from(sourceRuns)
    .innerJoin(sources, eq(sources.id, sourceRuns.sourceId))
    .where(inArray(sources.adapter, ["planilha", "manual"]))
    .orderBy(desc(sourceRuns.startedAt))
    .limit(limit);
  return rows.map((p) => ({ ...p.r, sourceName: p.sourceName }));
}

export async function layersOverview() {
  return getDb().select().from(layers).orderBy(layers.category, layers.key);
}
