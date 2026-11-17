import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { properties } from "@/db/schema";
import type { Evaluation } from "@/domain/evaluation";
import type { Mode } from "@/domain/listing";
import { maxPriceFor } from "@/domain/affordability";
import { locatedWorkplaces } from "@/domain/profile";
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
  const rows = await db
    .select({
      id: p.id, title: p.title, neighborhood: p.neighborhood, regional: p.regional, photo: p.photo, areaM2: p.areaM2, bedrooms: p.bedrooms,
      priceCents: buy ? p.salePriceCents : p.totalCents, rentCents: p.rentCents, priceM2Cents: buy ? p.salePriceM2Cents : p.costPerM2Cents, yieldBp: p.grossYieldBp,
      commuteMinutes: p.commuteMinutes, score: buy ? p.saleEvalScore : p.rentEvalScore, evaluation: buy ? p.saleEval : p.rentEval,
      riskLevel: p.riskLevel, floodLevel: p.floodLevel, isDemo: p.isDemo,
    })
    .from(p)
    .where(and(eq(p.status, "ativo"), buy ? eq(p.forSale, true) : eq(p.forRent, true), eq(p.isDemo, demo)))
    .orderBy(desc(sql`coalesce(${buy ? p.saleEvalScore : p.rentEvalScore}, -1)`))
    .limit(5000);

  const picks: GuidePick[] = rows.map((r) => ({ ...r, priceCents: r.priceCents ?? r.rentCents, evaluation: (r.evaluation ?? null) as Evaluation | null }));
  const max = maxPriceFor(profile);
  const hasWorkplaces = locatedWorkplaces(profile).length > 0;
  const fits = (x: GuidePick) =>
    (!hasWorkplaces || (x.commuteMinutes != null && x.commuteMinutes <= profile.maxCommuteMin)) &&
    (!buy || max.cents == null || (x.priceCents != null && x.priceCents <= max.cents));

  const regionRows = (key: "regional" | "neighborhood"): RegionRow[] =>
    rows.map((r) => ({
      area: r[key], priceM2Cents: r.priceM2Cents, yieldBp: buy ? r.yieldBp : null, commuteMin: r.commuteMinutes, evalScore: r.score,
      inFloodArea: r.floodLevel == null ? null : r.floodLevel >= 2, riskHigh: r.riskLevel == null ? null : r.riskLevel === "alto" || r.riskLevel === "atencao",
    }));
  const opts = { maxCommuteMin: profile.maxCommuteMin, mode };
  return {
    mode, demo, total: rows.length, hasWorkplaces, workplaces: profile.workplaces.length, maxCommuteMin: profile.maxCommuteMin,
    maxPriceCents: max.cents, limitedBy: max.limitedBy,
    picks: picks.slice(0, 9),
    fitPicks: picks.filter(fits).slice(0, 9),
    regionais: compareRegions(regionRows("regional"), opts),
    bairros: compareRegions(regionRows("neighborhood"), opts).slice(0, 40),
  };
}
