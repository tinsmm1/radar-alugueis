import "server-only";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { collectionRuns, layers, sourceRuns, sources } from "@/db/schema";
import type { RiskLayerKey } from "@/domain/layers";
import { logger } from "@/lib/logger";
import { analyzePending } from "../geo/analyze";
import { geocodePending } from "../geo/geocode";
import { loadOsmStep } from "../geo/osm";
import { loadRegionais } from "../geo/regionais";
import { loadSgbLayer } from "../geo/sgb";
import { checkPriceTargets } from "../notify/events";
import { evChargerMatches, profileMatches } from "../notify/profile-alerts";
import { deliverPending } from "../notify/deliver";
import { ADAPTERS } from "../sources/registry";
import { refreshOpportunities } from "./opportunities";
import { refreshCommutes } from "../commute/refresh";
import { applyRetention } from "./retention";
import { collectSource } from "./source-run";

export type Trigger = "github" | "vercel" | "manual";
export const STAGES = ["fontes", "camadas", "geocodificar", "analisar", "deslocamento", "oportunidades", "notificar", "retencao", "concluido"] as const;
export type Stage = (typeof STAGES)[number];
export type StepResult = { runId: number; stage: Stage; more: boolean; note: string };

/** A new run starts only if none started in this window (06:00 and 18:00 runs are 12 h apart). */
const NEW_RUN_GAP_HOURS = 2;
/** An unfinished run older than this is abandoned (the next call starts a fresh one). */
const STALE_HOURS = 6;

const LAYER_TTL_DAYS: Record<string, number> = { sgb_inundacao: 90, sgb_movimento_massa: 90, sgb_enxurrada: 90, sgb_risco_geologico: 90, regionais: 180, osm: 30 };

async function currentRun(trigger: Trigger): Promise<{ id: number; stage: Stage; stats: Record<string, unknown> } | null> {
  const db = getDb();
  await db.update(collectionRuns).set({ status: "failed", error: "Execução abandonada (sem conclusão em 6 h).", finishedAt: new Date() }).where(and(eq(collectionRuns.status, "running"), lt(collectionRuns.startedAt, sql`now() - make_interval(hours => ${STALE_HOURS})`)));
  const [open] = await db.select().from(collectionRuns).where(eq(collectionRuns.status, "running")).orderBy(desc(collectionRuns.startedAt)).limit(1);
  if (open) return { id: open.id, stage: (open.stage ?? "fontes") as Stage, stats: (open.stats ?? {}) as Record<string, unknown> };
  const [recent] = await db.select({ id: collectionRuns.id }).from(collectionRuns).where(gte(collectionRuns.startedAt, sql`now() - make_interval(hours => ${NEW_RUN_GAP_HOURS})`)).limit(1);
  if (recent && trigger !== "manual") return null;
  const [row] = await db.insert(collectionRuns).values({ trigger, stage: "fontes", stats: {} }).returning();
  return { id: row.id, stage: "fontes", stats: {} };
}

async function dueLayer(): Promise<string | null> {
  const rows = await getDb().select().from(layers);
  const state = new Map(rows.map((r) => [r.key, r]));
  if (state.get("osm")?.status === "carregando") return "osm";
  for (const key of Object.keys(LAYER_TTL_DAYS)) {
    const r = state.get(key);
    const age = r?.refreshedAt ? (Date.now() - r.refreshedAt.getTime()) / 86_400_000 : Infinity;
    if (!r || r.status !== "ok" || age > LAYER_TTL_DAYS[key]) return key;
  }
  return null;
}

/** One stage's worth of work within the deadline; returns whether the stage is complete. */
async function work(stage: Stage, runId: number, deadline: number, stats: Record<string, unknown>): Promise<{ done: boolean; note: string }> {
  const db = getDb();
  switch (stage) {
    case "fontes": {
      const done = new Set((await db.select({ id: sourceRuns.sourceId }).from(sourceRuns).where(eq(sourceRuns.runId, runId))).map((r) => r.id));
      const scheduled = Object.entries(ADAPTERS).filter(([, a]) => a.scheduled).map(([k]) => k);
      const todo = (await db.select().from(sources).where(and(inArray(sources.adapter, scheduled), inArray(sources.status, ["ativa", "pendente"])))).filter((s) => !done.has(s.id));
      for (const s of todo) {
        if (Date.now() > deadline - 15_000) return { done: false, note: `fontes: ${done.size} de ${done.size + todo.length}` };
        const r = await collectSource(s, runId);
        done.add(s.id);
        stats[`fonte:${s.key}`] = r.status;
      }
      return { done: true, note: "fontes concluídas" };
    }
    case "camadas": {
      for (let key = await dueLayer(); key; key = await dueLayer()) {
        if (Date.now() > deadline - 8_000) return { done: false, note: `camada ${key} pendente` };
        try {
          if (key === "osm") {
            const r = await loadOsmStep(deadline);
            if (!r.done) return { done: false, note: `OSM ${r.index}/${r.total}` };
          } else if (key === "regionais") {
            if (!(await loadRegionais(deadline)).done) return { done: false, note: "regionais em andamento" };
          } else await loadSgbLayer(key as RiskLayerKey);
        } catch (err) {
          stats[`camada:${key}`] = (err as Error).message.slice(0, 200);
          logger.warn({ layer: key, msg: (err as Error).message }, "layer refresh failed");
          return { done: true, note: `camada ${key} falhou; segue com a versão anterior` };
        }
      }
      return { done: true, note: "camadas em dia" };
    }
    case "geocodificar": {
      const r = await geocodePending(deadline);
      stats.geocodificados = Number(stats.geocodificados ?? 0) + r.located;
      return { done: !r.remaining || r.tried === 0, note: `${r.located} localizados` };
    }
    case "analisar": {
      const r = await analyzePending(deadline);
      stats.analisados = Number(stats.analisados ?? 0) + r.analyzed;
      return { done: !r.remaining || (r.analyzed === 0 && !r.waiting), note: `${r.analyzed} analisados` };
    }
    case "deslocamento": {
      const r = await refreshCommutes(deadline);
      stats.deslocamentos = Number(stats.deslocamentos ?? 0) + r.updated;
      return { done: !r.remaining, note: `${r.updated} deslocamentos calculados` };
    }
    case "oportunidades": {
      stats.oportunidades = (await refreshOpportunities()).withSignals;
      return { done: true, note: "oportunidades atualizadas" };
    }
    case "notificar": {
      stats.precoAlvo = await checkPriceTargets();
      stats.perfil = await profileMatches();
      stats.carregador = await evChargerMatches();
      const r = await deliverPending();
      stats.emails = r.email;
      stats.telegram = r.telegram;
      return { done: true, note: `${r.email} por e-mail, ${r.telegram} por Telegram` };
    }
    case "retencao": {
      stats.retencao = await applyRetention();
      return { done: true, note: "retenção aplicada" };
    }
    default:
      return { done: true, note: "" };
  }
}

/**
 * Advances the current collection run for up to `budgetMs` (one HTTP call). The scheduler
 * calls again while `more` is true, so long runs fit serverless time limits; any later call
 * resumes where it stopped.
 */
export async function runStep(trigger: Trigger, budgetMs = 50_000): Promise<StepResult | null> {
  const db = getDb();
  const run = await currentRun(trigger);
  if (!run) return null;
  const deadline = Date.now() + budgetMs;
  let stage = run.stage;
  let note = "";
  const started = Date.now();
  while (stage !== "concluido" && Date.now() < deadline - 2_000) {
    const r = await work(stage, run.id, deadline, run.stats);
    note = r.note;
    if (!r.done) break;
    stage = STAGES[STAGES.indexOf(stage) + 1];
    await db.update(collectionRuns).set({ stage, stats: run.stats }).where(eq(collectionRuns.id, run.id));
  }
  if (stage === "concluido") {
    const [{ failed, total }] = await db.select({ failed: sql<number>`count(*) filter (where status = 'failed')::int`, total: sql<number>`count(*)::int` }).from(sourceRuns).where(eq(sourceRuns.runId, run.id));
    const [row] = await db.select({ startedAt: collectionRuns.startedAt }).from(collectionRuns).where(eq(collectionRuns.id, run.id));
    await db
      .update(collectionRuns)
      .set({ status: failed ? (failed === total ? "failed" : "partial") : "ok", stage, finishedAt: new Date(), durationMs: Date.now() - (row?.startedAt.getTime() ?? started), stats: run.stats, error: failed ? `${failed} fonte(s) com falha` : null })
      .where(eq(collectionRuns.id, run.id));
  } else {
    await db.update(collectionRuns).set({ stage, stats: run.stats }).where(eq(collectionRuns.id, run.id));
  }
  return { runId: run.id, stage, more: stage !== "concluido", note };
}
