import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { apifyTaskId } from "@/domain/apify";
import { actorPricing, planRun, type RunPlan } from "@/domain/apify-budget";
import { actorInput, isDefaultFilters, type Business } from "@/domain/collect-filters";
import { getDb } from "@/db";
import { sources } from "@/db/schema";
import { optionalEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeFetch } from "../http";
import { getCollectFilters } from "../collect-filters";

const API = "https://api.apify.com/v2";
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ITEMS_READ = 5_000;
/** A new run starts only when the last one began this long ago (one run per day per task). */
const MIN_HOURS_BETWEEN_RUNS = 20;

/** Thrown when the source cannot run yet (missing token): recorded as skipped, not failed. */
export class ApifySkip extends Error {}

function token(): string {
  const t = optionalEnv("APIFY_TOKEN");
  if (!t) throw new ApifySkip("Defina a variável APIFY_TOKEN para coletar pelo Apify.");
  return t;
}

function taskPath(task: string): string {
  const id = apifyTaskId(task);
  if (!id) throw new Error("Identificador de tarefa do Apify inválido.");
  return `${API}/actor-tasks/${encodeURIComponent(id)}`;
}

async function call(url: string, opts: { method?: "GET" | "POST"; notFound?: "null"; body?: unknown } = {}): Promise<unknown> {
  const res = await safeFetch(url, {
    method: opts.method,
    body: opts.method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
    maxBytes: MAX_BYTES,
    timeoutMs: 40_000,
    accept: "application/json",
    headers: { authorization: `Bearer ${token()}`, ...(opts.method === "POST" ? { "content-type": "application/json" } : {}) },
    allowRedirectTo: (u) => u.hostname.endsWith("apify.com"),
  });
  if (res.status === 404 && opts.notFound === "null") return null;
  if (res.status === 401 || res.status === 403) throw new Error(`O Apify recusou o token (HTTP ${res.status}). Confira APIFY_TOKEN.`);
  if (res.status === 404) throw new Error("Tarefa do Apify não encontrada ou ainda sem execução concluída.");
  if (res.status < 200 || res.status >= 300) throw new Error(`O Apify respondeu HTTP ${res.status}.`);
  try {
    return JSON.parse(res.body.toString("utf8")) as unknown;
  } catch {
    throw new Error("O Apify devolveu uma resposta que não é JSON.");
  }
}

type Obj = Record<string, unknown>;
const data = (v: unknown): Obj => (v && typeof v === "object" && "data" in v && v.data && typeof v.data === "object" ? (v.data as Obj) : {});

/** Run states whose dataset is final (a run stopped by its cost cap is ABORTED but its items are valid). */
const FINISHED = new Set(["SUCCEEDED", "ABORTED", "TIMED-OUT"]);

/** Items of the last finished run of the task ([] when there is none yet). */
export async function fetchApifyItems(task: string): Promise<unknown[]> {
  const run = data(await call(`${taskPath(task)}/runs/last`, { notFound: "null" }));
  const datasetId = typeof run.defaultDatasetId === "string" ? run.defaultDatasetId : null;
  if (!datasetId || !FINISHED.has(String(run.status))) {
    const items = await call(`${taskPath(task)}/runs/last/dataset/items?status=SUCCEEDED&clean=true&format=json&limit=${MAX_ITEMS_READ}`, { notFound: "null" });
    return Array.isArray(items) ? items : [];
  }
  const items = await call(`${API}/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&limit=${MAX_ITEMS_READ}`, { notFound: "null" });
  return Array.isArray(items) ? items : [];
}

/** Works out today's caps from the account usage and the actor's current price. */
export async function planApifyRun(task: string, now = new Date()): Promise<RunPlan> {
  const base = taskPath(task);
  const [taskInfo, limits, active] = await Promise.all([
    call(base),
    call(`${API}/users/me/limits`),
    getDb().select({ id: sources.id }).from(sources).where(and(eq(sources.adapter, "apify"), inArray(sources.status, ["ativa"]))),
  ]);
  const actId = String(data(taskInfo).actId ?? "");
  if (!actId) throw new Error("Não foi possível identificar o robô da tarefa no Apify.");
  const actor = data(await call(`${API}/acts/${encodeURIComponent(actId)}`));
  const l = data(limits);
  const cycle = (l.monthlyUsageCycle ?? {}) as Obj;
  const current = (l.current ?? {}) as Obj;
  const caps = (l.limits ?? {}) as Obj;
  const cycleEnd = new Date(String(cycle.endAt ?? ""));
  return planRun({
    pricing: actorPricing(actor.pricingInfos),
    usedUsd: Number(current.monthlyUsageUsd ?? 0) || 0,
    accountLimitUsd: typeof caps.maxMonthlyUsageUsd === "number" ? caps.maxMonthlyUsageUsd : null,
    cycleEnd: Number.isNaN(cycleEnd.getTime()) ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : cycleEnd,
    now,
    activeTasks: active.length,
  });
}

/**
 * Starts today's run of the task (at most one per day) with the automatic caps. Its results are read
 * by the next collection. Never throws: a failure here must not lose the listings already read.
 */
export async function startDailyApifyRun(task: string, now = new Date()): Promise<string> {
  try {
    const last = data(await call(`${taskPath(task)}/runs/last`, { notFound: "null" }));
    const startedAt = new Date(String(last.startedAt ?? 0)).getTime();
    if (last.status === "RUNNING" || last.status === "READY") return "Execução do Apify ainda em andamento.";
    if (now.getTime() - startedAt < MIN_HOURS_BETWEEN_RUNS * 3_600_000) return "Execução de hoje já iniciada.";
    const plan = await planApifyRun(task, now);
    if (!plan.run) return plan.reason;
    const q = new URLSearchParams({ maxItems: String(plan.maxItems), maxTotalChargeUsd: plan.maxChargeUsd.toFixed(2) });
    if (plan.timeoutSecs) q.set("timeout", String(plan.timeoutSecs));
    if (plan.memoryMbytes) q.set("memory", String(plan.memoryMbytes));
    // The owner's filters go with the run (merged over the task input), so the robot only charges for matching listings.
    const [taskInfo, filters] = await Promise.all([call(taskPath(task)), getCollectFilters()]);
    const input = (data(taskInfo).input ?? {}) as Obj;
    const business: Business = input.business === "SALE" || input.business === "RENTAL" ? input.business : null;
    await call(`${taskPath(task)}/runs?${q.toString()}`, { method: "POST", body: actorInput(filters, business) });
    const note = `${isDefaultFilters(filters) ? "" : "Com filtros. "}Execução iniciada: até ${plan.maxItems} anúncios e US$ ${plan.maxChargeUsd.toFixed(2)} (restam US$ ${plan.budgetLeftUsd.toFixed(2)} para ${plan.runsLeft} execuções no ciclo).`;
    logger.info({ task: apifyTaskId(task), ...plan }, "apify run started");
    return note;
  } catch (err) {
    logger.warn({ msg: (err as Error).message }, "apify run not started");
    return `Execução do Apify não iniciada: ${(err as Error).message}`;
  }
}
