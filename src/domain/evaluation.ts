import { meters, pctBp } from "./money";
import type { LocationFacts, RiskIndex } from "./risk";
import type { UrbanKind } from "./layers";
import { commuteFraction, commuteNotes, type CommuteSummary } from "./commute";
import type { Negotiation } from "./negotiation";
import { WEIGHT_KEYS, type WeightKey } from "./profile";

/**
 * Critical evaluation of one offer in one mode: a 0–100 grade made of explained parts (price
 * against comparables, running cost or yield, convenience, the home itself; geographic risk is a separate note),
 * with strengths and points of attention. Unknown inputs score neutral and lower the
 * confidence; they are never read as good news.
 */
export type EvalMode = "aluguel" | "compra";

export type EvalInput = {
  mode: EvalMode;
  /** Price per m² against the median of comparables: positive = below the median (%). */
  priceVsMedianPct: number | null;
  comparables: number;
  comparableScope: "bairro" | "regional" | "regional_todos" | null;
  /** Recent price drop in basis points (last 30 days), if any. */
  recentDropBp: number | null;
  /** Rent: whether the known monthly cost is complete. */
  costComplete: boolean | null;
  /** Buy: gross yield from the rent estimate (bp). */
  yieldBp: number | null;
  facts: LocationFacts | null;
  risk: RiskIndex | null;
  parking: number | null;
  featureCount: number;
  areaM2: number | null;
  exactLocation: boolean;
  sources: number;
  /** Commute to the owner's workplaces at their times (null/absent = no workplace configured). */
  commute?: CommuteSummary | null;
  maxCommuteMin?: number;
  /** Normalised weights (sum 100) from the owner's profile; absent = classic weights 50/15/25/10. */
  weights?: Record<WeightKey, number>;
  /** Negotiation plan, carried in the stored evaluation for the property page. */
  negotiation?: Negotiation | null;
};

export type Grade = "A" | "B" | "C" | "D" | "E";
export type EvalPart = { key: "preco" | "custos" | "rendimento" | "risco" | "conveniencia" | "deslocamento" | "imovel"; label: string; points: number; max: number };
export type CommuteBrief = { avgOneWayMin: number; worstOneWayMin: number; worstName: string; monthlyHours: number; monthlyCostCents: number; monthlyTimeCostCents: number; method: CommuteSummary["method"] };
export type Evaluation = {
  score: number;
  grade: Grade;
  label: string;
  confidence: "alta" | "media" | "baixa";
  parts: EvalPart[];
  pros: string[];
  cons: string[];
  /** Geographic risk (landslide, flood...) shown with the grade but never counted in it. */
  riskNote?: string | null;
  commute?: CommuteBrief | null;
  negotiation?: Negotiation | null;
};

export const GRADE_LABEL: Record<Grade, string> = { A: "Excelente", B: "Boa", C: "Na média", D: "Abaixo da média", E: "Fraca" };
export const CONFIDENCE_LABEL: Record<Evaluation["confidence"], string> = { alta: "Confiança alta", media: "Confiança média", baixa: "Confiança baixa" };
export const EVALUATION_NOTE =
  "Nota automática que compara o anúncio com imóveis parecidos coletados pelo Radar e resume as bases geográficas consultadas. Não é avaliação imobiliária, laudo nem vistoria.";

export function gradeOf(score: number): Grade {
  return score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "E";
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const SCOPE_TEXT = { bairro: "no mesmo bairro", regional: "na mesma regional", regional_todos: "na regional (todos os tipos)" } as const;

const CONVENIENCE: Array<{ kinds: UrbanKind[]; within: number; points: number; label: string }> = [
  { kinds: ["metro", "estacao_onibus"], within: 800, points: 5, label: "Estação de metrô ou BRT" },
  { kinds: ["supermercado"], within: 600, points: 3, label: "Supermercado" },
  { kinds: ["farmacia"], within: 600, points: 2, label: "Farmácia" },
  { kinds: ["parque"], within: 500, points: 3, label: "Parque ou área verde" },
  { kinds: ["hospital"], within: 1500, points: 2, label: "Hospital" },
];

function nearestOf(f: LocationFacts, kinds: UrbanKind[]): number | null {
  const ds = kinds.map((k) => f.nearest[k]?.distanceM).filter((d): d is number => d != null);
  return ds.length ? Math.min(...ds) : null;
}

export function evaluate(i: EvalInput): Evaluation {
  const pros: string[] = [];
  const cons: string[] = [];
  let unknowns = 0;
  const unit = i.mode === "compra" ? "Preço por m²" : "Custo mensal por m²";

  // Price against comparables (50).
  let price = 25;
  if (i.priceVsMedianPct == null) {
    unknowns++;
    cons.push("Ainda não há imóveis comparáveis suficientes para avaliar o preço.");
  } else {
    price = clamp(25 + i.priceVsMedianPct * 1.25, 0, 50);
    const where = SCOPE_TEXT[i.comparableScope ?? "regional"];
    const p = Math.abs(Math.round(i.priceVsMedianPct));
    if (i.priceVsMedianPct >= 5) pros.push(`${unit} ${p}% abaixo da mediana de ${i.comparables} imóveis parecidos ${where}.`);
    else if (i.priceVsMedianPct <= -5) cons.push(`${unit} ${p}% acima da mediana de ${i.comparables} imóveis parecidos ${where}.`);
    else pros.push(`${unit} alinhado à mediana de ${i.comparables} imóveis parecidos ${where}.`);
  }
  if (i.recentDropBp != null && i.recentDropBp >= 100) {
    price = Math.min(50, price + 4);
    pros.push(`Preço reduzido em ${pctBp(i.recentDropBp)} nos últimos 30 dias.`);
  }

  // Running cost (rent) or yield (buy) (15).
  let second: EvalPart;
  if (i.mode === "aluguel") {
    let pts = 5;
    if (i.costComplete === true) {
      pts = 10;
      pros.push("Custo mensal completo conhecido (aluguel, condomínio e IPTU).");
    } else if (i.costComplete === false) {
      pts = 3;
      cons.push("Custo mensal parcial: confirme condomínio, IPTU e taxas com o anunciante.");
    }
    second = { key: "custos", label: "Clareza dos custos", points: pts, max: 10 };
  } else {
    let pts = 5;
    if (i.yieldBp == null) {
      unknowns++;
      cons.push("Sem aluguel estimado para calcular o rendimento (faltam aluguéis comparáveis).");
    } else if (i.yieldBp >= 600) {
      pts = 10;
      pros.push(`Rendimento bruto estimado alto: ${pctBp(i.yieldBp)} ao ano.`);
    } else if (i.yieldBp >= 450) {
      pts = 7;
      pros.push(`Rendimento bruto estimado de ${pctBp(i.yieldBp)} ao ano.`);
    } else if (i.yieldBp >= 350) pts = 4;
    else {
      pts = 1;
      cons.push(`Rendimento bruto estimado baixo: ${pctBp(i.yieldBp)} ao ano.`);
    }
    second = { key: "rendimento", label: "Rendimento estimado", points: pts, max: 10 };
  }

  // Geographic risk is informative only (owner decision): it never changes the grade.
  let riskNote: string | null = null;
  if (i.risk) {
    const why = i.risk.reasons.slice(0, 2).join("; ");
    riskNote =
      i.risk.level === "alto" || i.risk.level === "atencao"
        ? `Risco geográfico ${i.risk.level === "alto" ? "alto" : "de atenção"}: ${why}.`
        : i.risk.level === "moderado"
          ? `Risco geográfico moderado: ${why}.`
          : "Risco geográfico baixo segundo as bases consultadas (não substitui vistoria).";
  }

  // Convenience around the address (25).
  let conv = 7;
  if (i.facts?.coverage.osm) {
    conv = 0;
    const near: string[] = [];
    for (const c of CONVENIENCE) {
      const d = nearestOf(i.facts, c.kinds);
      if (d != null && d <= c.within) {
        conv += c.points;
        near.push(`${c.label.toLowerCase()} a ${meters(d)}`);
      }
    }
    if (near.length) pros.push(`Perto de: ${near.join(", ")}.`);
    const transit = nearestOf(i.facts, ["metro", "estacao_onibus"]);
    if (transit == null || transit > 1500) cons.push("Sem estação de metrô ou BRT a menos de 1,5 km.");
    if (near.length <= 1) cons.push("Poucos serviços essenciais mapeados por perto.");
  }

  // The home and the data about it (10).
  let home = 0;
  if (i.parking != null && i.parking > 0) home += 3;
  else if (i.parking === 0) cons.push("Sem vaga de garagem.");
  home += Math.min(3, Math.floor(i.featureCount / 2));
  if (i.areaM2 != null) home += 1;
  if (i.exactLocation) home += 2;
  else {
    unknowns++;
    cons.push("Localização aproximada: a análise usa o centro da rua ou do bairro.");
  }
  if (i.sources > 1) {
    home += 1;
    pros.push(`Anunciado em ${i.sources} fontes (dados conferidos entre elas).`);
  }

  // Commute to the owner's workplaces (only when a profile with located workplaces exists).
  let commuteF: number | null = null;
  if (i.commute) {
    commuteF = commuteFraction(i.commute, i.maxCommuteMin ?? 45);
    const notes = commuteNotes(i.commute, i.maxCommuteMin ?? 45);
    pros.push(...notes.pros);
    cons.push(...notes.cons);
  }

  let parts: EvalPart[];
  if (!i.weights && commuteF == null) {
    parts = [
      { key: "preco", label: "Preço frente a parecidos", points: Math.round(price), max: 50 },
      { ...second, points: Math.round(second.points * 1.5), max: 15 },
      { key: "conveniencia", label: "Serviços e transporte", points: Math.round((conv * 25) / 15), max: 25 },
      { key: "imovel", label: "Imóvel e dados", points: Math.min(10, home), max: 10 },
    ];
  } else {
    const w = { ...(i.weights ?? { preco: 40, custos: 12, deslocamento: commuteF == null ? 0 : 20, servicos: 18, imovel: 10 }) };
    if (commuteF == null) w.deslocamento = 0;
    const maxes = roundTo100(w);
    const frac: Record<WeightKey, number> = { preco: price / 50, custos: second.points / 10, deslocamento: commuteF ?? 0, servicos: Math.min(1, conv / 15), imovel: Math.min(10, home) / 10 };
    const label: Record<WeightKey, [EvalPart["key"], string]> = {
      preco: ["preco", "Preço frente a parecidos"], custos: [second.key, second.label], deslocamento: ["deslocamento", "Tempo até o trabalho"],
      servicos: ["conveniencia", "Serviços e transporte"], imovel: ["imovel", "Imóvel e dados"],
    };
    parts = WEIGHT_KEYS.filter((k) => maxes[k] > 0).map((k) => ({ key: label[k][0], label: label[k][1], points: Math.round(frac[k] * maxes[k]), max: maxes[k] }));
  }
  const score = clamp(Math.round(parts.reduce((s, p) => s + p.points, 0)), 0, 100);
  const grade = gradeOf(score);
  const commute: CommuteBrief | null = i.commute
    ? { avgOneWayMin: i.commute.avgOneWayMin, worstOneWayMin: i.commute.worstOneWayMin, worstName: i.commute.worstName, monthlyHours: i.commute.monthlyHours, monthlyCostCents: i.commute.monthlyCostCents, monthlyTimeCostCents: i.commute.monthlyTimeCostCents, method: i.commute.method }
    : null;
  return { score, grade, label: GRADE_LABEL[grade], confidence: unknowns === 0 ? "alta" : unknowns === 1 ? "media" : "baixa", parts, pros, cons, riskNote, commute, negotiation: i.negotiation ?? null };
}

/** Integer maxima that keep the weights' proportions and add up to exactly 100. */
function roundTo100(w: Record<WeightKey, number>): Record<WeightKey, number> {
  const sum = WEIGHT_KEYS.reduce((s, k) => s + w[k], 0) || 1;
  const raw = WEIGHT_KEYS.map((k) => ({ k, v: (w[k] * 100) / sum }));
  const out = Object.fromEntries(raw.map(({ k, v }) => [k, Math.floor(v)])) as Record<WeightKey, number>;
  let left = 100 - WEIGHT_KEYS.reduce((s, k) => s + out[k], 0);
  for (const { k } of [...raw].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (left <= 0) break;
    out[k]++;
    left--;
  }
  return out;
}

/** Inputs of a neighbourhood's place grade (all measured around its centre or over its properties). */
export type PlaceInput = {
  avgRisk: number | null;
  floodPct: number | null;
  nearestTransitM: number | null;
  transitStations: number;
  supermarkets: number;
  pharmacies: number;
  hospitals: number;
  parks: number;
};

/**
 * Place grade of a neighbourhood (0–100), independent of prices: services and transport
 * within 1 km of its centre. Geographic risk is shown apart and never counted.
 */
export function placeScore(i: PlaceInput): { score: number | null; grade: Grade | null; pros: string[]; cons: string[] } {
  const pros: string[] = [];
  const cons: string[] = [];
  if (i.avgRisk == null && i.nearestTransitM == null && i.supermarkets + i.pharmacies + i.hospitals + i.parks === 0) return { score: null, grade: null, pros, cons };
  // Geographic risk stays out of the grade (owner decision); the neighbourhood page still shows it.
  let services = 0;
  if (i.nearestTransitM != null && i.nearestTransitM <= 800) {
    services += 15;
    pros.push(`Metrô ou BRT a ${meters(i.nearestTransitM)} do centro`);
  } else if (i.nearestTransitM != null && i.nearestTransitM <= 1500) services += 8;
  else cons.push("Metrô ou BRT longe do centro do bairro");
  services += Math.min(5, i.transitStations) + Math.min(10, i.supermarkets * 2) + Math.min(8, i.pharmacies) + Math.min(6, i.hospitals * 3) + Math.min(6, i.parks * 2);
  if (i.supermarkets + i.pharmacies >= 6) pros.push("Bem servido de comércio essencial");
  if (i.supermarkets === 0) cons.push("Nenhum supermercado mapeado a 1 km do centro");
  const score = clamp(Math.round(Math.min(50, services) * 2), 0, 100);
  return { score, grade: gradeOf(score), pros, cons };
}
