/**
 * Automatic Apify budget: before each daily run the Radar reads the account usage and the actor's
 * price, and spreads what is left of the monthly free credit over the runs still to come in the
 * billing cycle (one per day per active task). The run is then started with platform-enforced caps
 * (maxItems, maxTotalChargeUsd; timeout and memory for usage-priced actors), so the credit lasts
 * the whole month. Pure maths, values in US dollars.
 */

/** Monthly credit of the Apify Free plan; never plan above it, even on a paid account. */
export const FREE_CREDIT_USD = 5;
/** Kept unused for dataset reads, storage and manual test runs. */
export const RESERVE = 0.1;
/** Runs per day per task (the Radar starts at most one). */
export const RUNS_PER_DAY = 1;
/** Below this many results a run is not worth its start fee: skip it. */
export const MIN_ITEMS = 5;
export const MAX_ITEMS = 1000;
/** Conservative compute unit price (1 GB·hour) for actors priced by platform usage only. */
export const CU_PRICE_USD = 0.4;
export const USAGE_MEMORY_MB = 1024;

export type ActorPricing =
  | { model: "per_item"; perItemUsd: number; startFeeUsd: number }
  | { model: "usage" }
  | { model: "monthly" };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const price = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Flat price, or the highest tier (conservative) when the price is tiered by plan. */
function priceOf(flat: unknown, tiers: unknown, tierKey: string): number | null {
  const p = price(flat);
  if (p != null) return p;
  if (!isObj(tiers)) return null;
  const values = Object.values(tiers).map((t) => price(isObj(t) ? t[tierKey] : t)).filter((n): n is number => n != null);
  return values.length ? Math.max(...values) : null;
}

/** Current pricing of an actor from its `pricingInfos` (the most recent entry wins). */
export function actorPricing(pricingInfos: unknown): ActorPricing {
  const list = Array.isArray(pricingInfos) ? pricingInfos.filter(isObj) : [];
  const current = [...list].sort((a, b) => String(a.startedAt ?? "").localeCompare(String(b.startedAt ?? ""))).pop();
  if (!current) return { model: "usage" };
  switch (current.pricingModel) {
    case "PRICE_PER_DATASET_ITEM": {
      const perItemUsd = priceOf(current.pricePerUnitUsd, current.tieredPricing, "tieredPricePerUnitUsd");
      return perItemUsd ? { model: "per_item", perItemUsd, startFeeUsd: 0 } : { model: "usage" };
    }
    case "PAY_PER_EVENT": {
      const events = isObj(current.pricingPerEvent) && isObj(current.pricingPerEvent.actorChargeEvents) ? current.pricingPerEvent.actorChargeEvents : {};
      let startFeeUsd = 0;
      let perItemUsd = 0;
      for (const [name, ev] of Object.entries(events)) {
        if (!isObj(ev)) continue;
        const p = priceOf(ev.eventPriceUsd, ev.eventTieredPricingUsd, "tieredEventPriceUsd") ?? 0;
        if (/start/i.test(name)) startFeeUsd += p;
        // Every other event is treated as charged once per result: the most expensive one bounds the cost.
        else perItemUsd = Math.max(perItemUsd, p);
      }
      return perItemUsd ? { model: "per_item", perItemUsd, startFeeUsd } : { model: "usage" };
    }
    case "FLAT_PRICE_PER_MONTH":
      return { model: "monthly" };
    default:
      return { model: "usage" };
  }
}

export type PlanInput = {
  pricing: ActorPricing;
  /** Usage so far in the current billing cycle (`current.monthlyUsageUsd`). */
  usedUsd: number;
  /** Account hard cap (`limits.maxMonthlyUsageUsd`); the plan never goes above FREE_CREDIT_USD. */
  accountLimitUsd: number | null;
  cycleEnd: Date;
  now: Date;
  /** Active Apify sources sharing the credit (e.g. rent and sale tasks). */
  activeTasks: number;
};

export type RunPlan =
  | { run: true; maxItems: number; maxChargeUsd: number; timeoutSecs: number | null; memoryMbytes: number | null; runsLeft: number; budgetLeftUsd: number }
  | { run: false; reason: string };

const DAY = 86_400_000;
const floor2 = (n: number) => Math.floor(n * 100 + 1e-9) / 100;

export function planRun(input: PlanInput): RunPlan {
  if (input.pricing.model === "monthly") return { run: false, reason: "O robô cobra mensalidade e não cabe no plano grátis: escolha um robô com preço por resultado." };
  const credit = Math.min(FREE_CREDIT_USD, input.accountLimitUsd ?? FREE_CREDIT_USD);
  const budgetLeftUsd = credit * (1 - RESERVE) - Math.max(0, input.usedUsd);
  const daysLeft = Math.max(1, Math.ceil((input.cycleEnd.getTime() - input.now.getTime()) / DAY));
  const runsLeft = daysLeft * RUNS_PER_DAY * Math.max(1, input.activeTasks);
  const perRun = budgetLeftUsd / runsLeft;
  if (perRun <= 0) return { run: false, reason: "Crédito grátis do mês já usado: as execuções voltam no próximo ciclo." };

  if (input.pricing.model === "usage") {
    // Cost = memory (GB) × hours × CU price: bound the run by its timeout.
    const timeoutSecs = Math.floor((perRun / (CU_PRICE_USD * (USAGE_MEMORY_MB / 1024))) * 3600);
    if (timeoutSecs < 60) return { run: false, reason: "Crédito restante pequeno demais para uma execução hoje." };
    return { run: true, maxItems: 100, maxChargeUsd: floor2(perRun), timeoutSecs, memoryMbytes: USAGE_MEMORY_MB, runsLeft, budgetLeftUsd: floor2(budgetLeftUsd) };
  }

  const { perItemUsd, startFeeUsd } = input.pricing;
  const maxItems = Math.min(MAX_ITEMS, Math.floor((perRun - startFeeUsd) / perItemUsd));
  if (maxItems < MIN_ITEMS) return { run: false, reason: "Crédito restante pequeno demais para uma execução hoje." };
  return { run: true, maxItems, maxChargeUsd: Math.max(0.01, floor2(perRun)), timeoutSecs: null, memoryMbytes: null, runsLeft, budgetLeftUsd: floor2(budgetLeftUsd) };
}
