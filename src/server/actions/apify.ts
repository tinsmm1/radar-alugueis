"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { sources } from "@/db/schema";
import { apifyTaskId, parseApifyItems } from "@/domain/apify";
import { collectFiltersSchema, DEFAULT_COLLECT_FILTERS, describeFilters, isDefaultFilters } from "@/domain/collect-filters";
import { optionalEnv } from "@/lib/env";
import { ApifySkip, fetchApifyItems, planApifyRun, startDailyApifyRun } from "../sources/apify-client";
import { feedKey } from "../sources/registry";
import { saveCollectFilters } from "../collect-filters";
import { ActionError, parse, runAction } from "./run-action";

const taskSchema = z.string().trim().min(3, "Informe a tarefa do Apify.").max(300).refine((t) => apifyTaskId(t) != null, "Tarefa inválida: use o ID (ex.: usuario~zap-bh) ou o link da tarefa.");

const apifySchema = z.object({
  name: z.string().trim().min(3, "Dê um nome à fonte (ex.: ZAP via Apify).").max(80),
  task: taskSchema,
  confirm: z.literal(true, "Confirme que entende os riscos da coleta automática."),
});

async function load(task: string) {
  if (!optionalEnv("APIFY_TOKEN")) throw new ActionError("Defina a variável APIFY_TOKEN (token do Apify) antes de testar.");
  try {
    const [items, plan] = await Promise.all([fetchApifyItems(task), planApifyRun(task)]);
    const planNote = plan.run ? `Limite automático por execução: até ${plan.maxItems} anúncios e US$ ${plan.maxChargeUsd.toFixed(2)}, uma vez por dia.` : plan.reason;
    return { ...parseApifyItems(items), planNote };
  } catch (err) {
    if (err instanceof ApifySkip || err instanceof Error) throw new ActionError(err.message);
    throw err;
  }
}

/** Reads the last run of the task and shows what would be imported (nothing is stored). */
export async function testApifyTask(task: string) {
  return runAction("testApifyTask", async () => {
    const res = await load(parse(taskSchema, task));
    return {
      provider: "Apify",
      count: res.listings.length,
      planNote: res.planNote,
      skipped: res.skipped,
      sample: res.listings.slice(0, 3).map((l) => ({ title: l.title, neighborhood: l.neighborhood, rentCents: l.rentCents ?? l.salePriceCents })),
    };
  });
}

export async function addApifySource(input: z.input<typeof apifySchema>) {
  return runAction("addApifySource", async () => {
    const f = parse(apifySchema, input);
    const key = feedKey(f.name, "apify");
    const db = getDb();
    const [exists] = await db.select({ id: sources.id }).from(sources).where(eq(sources.key, key)).limit(1);
    if (exists) throw new ActionError("Já existe uma fonte com esse nome.");
    const task = apifyTaskId(f.task)!;
    await db.insert(sources).values({ key, adapter: "apify", name: f.name, url: task, status: "ativa", authorization: "Coleta via Apify por decisão do dono (termos do portal não autorizam)." });
    // First run right away (with the automatic caps), so the next collection already has listings.
    const note = optionalEnv("APIFY_TOKEN") ? await startDailyApifyRun(task) : null;
    return { key, note };
  }, "/admin");
}

/** Saves the collection filters (null = back to the default: everything). Used from the next robot run. */
export async function saveApifyFilters(input: z.input<typeof collectFiltersSchema> | null) {
  return runAction("saveApifyFilters", async () => {
    const f = input == null ? null : parse(collectFiltersSchema, input);
    if (f && f.aluguelMin != null && f.aluguelMax != null && f.aluguelMax > 0 && f.aluguelMin > f.aluguelMax) throw new ActionError("O aluguel mínimo é maior que o máximo.");
    if (f && f.vendaMin != null && f.vendaMax != null && f.vendaMax > 0 && f.vendaMin > f.vendaMax) throw new ActionError("O preço de venda mínimo é maior que o máximo.");
    await saveCollectFilters(f && !isDefaultFilters(f) ? f : null);
    return { summary: describeFilters(f ?? DEFAULT_COLLECT_FILTERS) };
  }, "/admin");
}
