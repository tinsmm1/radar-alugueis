import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { properties } from "@/db/schema";
import type { Evaluation } from "@/domain/evaluation";
import type { Mode } from "@/domain/listing";
import { maxPriceFor } from "@/domain/affordability";
import { locatedWorkplaces, rentBudgetCents } from "@/domain/profile";
import { compareRegions, type RegionRow, type RegionStats } from "@/domain/regions";
import { getProfile } from "../profile";

export type GuidePick = {
  id: number; title: string | null; neighborhood: string | null; regional: string | null; photo: string | null;
  areaM2: number | null; bedrooms: number | null; priceCents: number | null; priceM2Cents: number | null; yieldBp: number | null;
  commuteMinutes: number | null; score: number | null; evaluation: Evaluation | null; riskLevel: string | null; isDemo: boolean;
};

export type Guide = {
  mode: Mode;
  demo: boolean;
  total: number;
  hasWorkplaces: boolean;
  workplaces: number;
  maxCommuteMin: number;
  maxPriceCents: number | null;
  limitedBy: "renda" | "reserva" | null;
  /** Renting: income × max share (monthly total), when income is known. */
  rentBudgetCents: number | null;
  picks: GuidePick[];
  /** Best picks within the commute limit and, for buying, within the budget. */
  fitPicks: GuidePick[];
  regionais: RegionStats[];
  bairros: RegionStats[];
};

/**
 * Data for the decision guide in one mode: profile summary, the best-graded offers (overall and
 * within the owner's limits), and the comparison of regionais and neighbourhoods. Real data
 * only when there is any; otherwise demo data, flagged.
 */
export async function guideData(mode: Mode): Promise<Guide> {
  const db = getDb();
  const profile = await getProfile();
  const buy = mode === "compra";
  const p = properties;
  const [{ real }] = (await db.select({ real: sql<number>`count(*) filter (where not ${p.isDemo})::int` }).from(p).where(and(eq(p.status, "ativo"), buy ? eq(p.forSale, true) : eq(p.forRent, true)))) as Array<{ real: number }>;
  const demo = !real;
  const score = buy ? p.saleEvalScore : p.rentEvalScore;
  const priceCol = buy ? p.salePriceCents : sql<number | null>`coalesce(${p.totalCents}, ${p.rentCents})`;
  const scope = and(eq(p.status, "ativo"), buy ? eq(p.forSale, true) : eq(p.forRent, true), eq(p.isDemo, demo));
  // Light rows for the region comparison (no JSON); the heavy evaluation only for the picks.
  const rows = await db
    .select({ regional: p.regional, neighborhood: p.neighborhood, priceM2Cents: buy ? p.salePriceM2Cents : p.costPerM2Cents, yieldBp: p.grossYieldBp, commuteMinutes: p.commuteMinutes, score, riskLevel: p.riskLevel, floodLevel: p.floodLevel })
    .from(p)
    .where(scope)
    .limit(20_000);

  const max = maxPriceFor(profile);
  const rentMax = rentBudgetCents(profile);
  const budget = buy ? max.cents : rentMax;
  const hasWorkplaces = locatedWorkplaces(profile).length > 0;
  const pickColumns = {
    id: p.id, title: p.title, neighborhood: p.neighborhood, regional: p.regional, photo: p.photo, areaM2: p.areaM2, bedrooms: p.bedrooms,
    priceCents: priceCol, priceM2Cents: buy ? p.salePriceM2Cents : p.costPerM2Cents, yieldBp: p.grossYieldBp, commuteMinutes: p.commuteMinutes,
    score, evaluation: buy ? p.saleEval : p.rentEval, riskLevel: p.riskLevel, isDemo: p.isDemo,
  };
  const order = [desc(sql`coalesce(${score}, -1)`), p.id];
  const toPick = (r: Record<string, unknown>) => ({ ...r, evaluation: (r.evaluation ?? null) as Evaluation | null }) as GuidePick;
  const [top, fit] = await Promise.all([
    db.select(pickColumns).from(p).where(scope).orderBy(...order).limit(9),
    db.select(pickColumns).from(p).where(and(scope, hasWorkplaces ? sql`${p.commuteMinutes} <= ${profile.maxCommuteMin}` : undefined, budget != null ? sql`${priceCol} <= ${budget}` : undefined)).orderBy(...order).limit(9),
  ]);

  const regionRows = (key: "regional" | "neighborhood"): RegionRow[] =>
    rows.map((r) => ({
      area: r[key], priceM2Cents: r.priceM2Cents, yieldBp: buy ? r.yieldBp : null, commuteMin: r.commuteMinutes, evalScore: r.score,
      inFloodArea: r.floodLevel == null ? null : r.floodLevel >= 2, riskHigh: r.riskLevel == null ? null : r.riskLevel === "alto" || r.riskLevel === "atencao",
    }));
  const opts = { maxCommuteMin: profile.maxCommuteMin, mode };
  return {
    mode, demo, total: rows.length, hasWorkplaces, workplaces: profile.workplaces.length, maxCommuteMin: profile.maxCommuteMin,
    maxPriceCents: max.cents, limitedBy: max.limitedBy, rentBudgetCents: rentMax,
    picks: top.map(toPick),
    fitPicks: fit.map(toPick),
    regionais: compareRegions(regionRows("regional"), opts),
    bairros: compareRegions(regionRows("neighborhood"), opts).slice(0, 40),
  };
}
