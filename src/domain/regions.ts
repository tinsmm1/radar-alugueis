import { gradeOf, type Grade } from "./evaluation";
import { median, percentile } from "./opportunity";

/**
 * Region comparison (regional or neighbourhood) for one mode: price level and spread,
 * yield (buy), commute to the owner's workplaces, quality of what is on offer, geographic
 * risk (shown, never counted — owner decision) and the "melhores posições": areas that no
 * other area beats at the same time on price per m² and on commute time (Pareto frontier).
 */
export type RegionRow = {
  area: string | null;
  priceM2Cents: number | null;
  yieldBp: number | null;
  commuteMin: number | null;
  evalScore: number | null;
  inFloodArea: boolean | null;
  riskHigh: boolean | null;
};

export type RegionStats = {
  area: string;
  count: number;
  medianPriceM2Cents: number | null;
  p25PriceM2Cents: number | null;
  p75PriceM2Cents: number | null;
  medianYieldBp: number | null;
  medianCommuteMin: number | null;
  avgEval: number | null;
  goodOffers: number;
  floodPct: number | null;
  riskHighPct: number | null;
  score: number | null;
  grade: Grade | null;
  frontier: boolean;
  pros: string[];
  cons: string[];
};

export const MIN_REGION_SAMPLE = 3;
export const REGIONS_NOTE =
  "Medianas dos imóveis ativos coletados pelo Radar em cada área. A nota da região combina preço por m² (frente às outras áreas), tempo até o trabalho e a qualidade das ofertas; o risco geográfico aparece ao lado e não entra na nota. Áreas com menos de 3 imóveis ficam sem nota.";

const pct = (xs: Array<boolean | null>) => {
  const known = xs.filter((x): x is boolean => x != null);
  return known.length ? Math.round((known.filter(Boolean).length / known.length) * 100) : null;
};
const def = <T,>(xs: Array<T | null>) => xs.filter((x): x is T => x != null);

export function compareRegions(rows: RegionRow[], opts: { maxCommuteMin: number; mode: "aluguel" | "compra" }): RegionStats[] {
  const groups = new Map<string, RegionRow[]>();
  for (const r of rows) {
    if (!r.area) continue;
    groups.set(r.area, [...(groups.get(r.area) ?? []), r]);
  }
  const stats: RegionStats[] = [...groups.entries()].map(([area, rs]) => {
    const prices = def(rs.map((r) => r.priceM2Cents));
    const commute = def(rs.map((r) => r.commuteMin));
    const evals = def(rs.map((r) => r.evalScore));
    return {
      area, count: rs.length,
      medianPriceM2Cents: median(prices), p25PriceM2Cents: percentile(prices, 25), p75PriceM2Cents: percentile(prices, 75),
      medianYieldBp: median(def(rs.map((r) => r.yieldBp))),
      medianCommuteMin: median(commute),
      avgEval: evals.length ? Math.round(evals.reduce((s, x) => s + x, 0) / evals.length) : null,
      goodOffers: evals.filter((e) => e >= 65).length,
      floodPct: pct(rs.map((r) => r.inFloodArea)), riskHighPct: pct(rs.map((r) => r.riskHigh)),
      score: null, grade: null, frontier: false, pros: [], cons: [],
    };
  });

  const eligible = stats.filter((s) => s.count >= MIN_REGION_SAMPLE && s.medianPriceM2Cents != null);
  const sortedPrices = eligible.map((s) => s.medianPriceM2Cents!).sort((a, b) => a - b);
  const hasCommute = eligible.some((s) => s.medianCommuteMin != null);
  for (const s of eligible) {
    // Price: 1 for the cheapest area, 0 for the most expensive (rank among areas).
    const rank = sortedPrices.length > 1 ? sortedPrices.indexOf(s.medianPriceM2Cents!) / (sortedPrices.length - 1) : 0.5;
    const priceF = 1 - rank;
    const m = s.medianCommuteMin;
    const commuteF = m == null ? 0.5 : m <= 15 ? 1 : m <= opts.maxCommuteMin ? 1 - (0.5 * (m - 15)) / Math.max(1, opts.maxCommuteMin - 15) : Math.max(0, 0.5 - (0.5 * (m - opts.maxCommuteMin)) / opts.maxCommuteMin);
    const evalF = s.avgEval == null ? 0.5 : s.avgEval / 100;
    const score = hasCommute ? 40 * priceF + 35 * commuteF + 25 * evalF : 60 * priceF + 40 * evalF;
    s.score = Math.round(score);
    s.grade = gradeOf(s.score);
    if (priceF >= 0.7) s.pros.push("Entre as áreas mais baratas por m²");
    if (priceF <= 0.2) s.cons.push("Entre as áreas mais caras por m²");
    if (m != null && m <= Math.min(25, opts.maxCommuteMin * 0.6)) s.pros.push(`Trabalho a ~${Math.round(m)} min (mediana)`);
    if (m != null && m > opts.maxCommuteMin) s.cons.push(`Trabalho a ~${Math.round(m)} min, acima do seu limite`);
    if (opts.mode === "compra" && s.medianYieldBp != null && s.medianYieldBp >= 550) s.pros.push("Rendimento bruto mediano alto");
    if (s.goodOffers >= 2) s.pros.push(`${s.goodOffers} ofertas com nota B ou melhor`);
    if (s.floodPct != null && s.floodPct >= 30) s.cons.push(`${s.floodPct}% dos imóveis em área suscetível a inundação`);
  }
  // Pareto frontier on (price per m², commute): nobody else is cheaper AND closer.
  const withBoth = eligible.filter((s) => s.medianCommuteMin != null);
  for (const s of withBoth) {
    s.frontier = !withBoth.some((o) => o !== s && o.medianPriceM2Cents! <= s.medianPriceM2Cents! && o.medianCommuteMin! <= s.medianCommuteMin! && (o.medianPriceM2Cents! < s.medianPriceM2Cents! || o.medianCommuteMin! < s.medianCommuteMin!));
    if (s.frontier) s.pros.unshift("Melhor posição: nenhuma área é ao mesmo tempo mais barata e mais perto do trabalho");
  }
  return stats.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.count - a.count);
}
