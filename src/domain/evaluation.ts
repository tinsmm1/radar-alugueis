import { meters, pctBp } from "./money";
import type { LocationFacts, RiskIndex } from "./risk";
import type { UrbanKind } from "./layers";

/**
 * Critical evaluation of one offer in one mode: a 0–100 grade made of explained parts (price
 * against comparables, running cost or yield, location risk, convenience, the home itself),
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
};

export type Grade = "A" | "B" | "C" | "D" | "E";
export type EvalPart = { key: "preco" | "custos" | "rendimento" | "risco" | "conveniencia" | "imovel"; label: string; points: number; max: number };
export type Evaluation = { score: number; grade: Grade; label: string; confidence: "alta" | "media" | "baixa"; parts: EvalPart[]; pros: string[]; cons: string[] };

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

  // Price against comparables (40).
  let price = 20;
  if (i.priceVsMedianPct == null) {
    unknowns++;
    cons.push("Ainda não há imóveis comparáveis suficientes para avaliar o preço.");
  } else {
    price = clamp(20 + i.priceVsMedianPct, 0, 40);
    const where = SCOPE_TEXT[i.comparableScope ?? "regional"];
    const p = Math.abs(Math.round(i.priceVsMedianPct));
    if (i.priceVsMedianPct >= 5) pros.push(`${unit} ${p}% abaixo da mediana de ${i.comparables} imóveis parecidos ${where}.`);
    else if (i.priceVsMedianPct <= -5) cons.push(`${unit} ${p}% acima da mediana de ${i.comparables} imóveis parecidos ${where}.`);
    else pros.push(`${unit} alinhado à mediana de ${i.comparables} imóveis parecidos ${where}.`);
  }
  if (i.recentDropBp != null && i.recentDropBp >= 100) {
    price = Math.min(40, price + 3);
    pros.push(`Preço reduzido em ${pctBp(i.recentDropBp)} nos últimos 30 dias.`);
  }

  // Running cost (rent) or yield (buy) (10).
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

  // Location risk (25).
  let risk = 12;
  if (!i.risk) {
    unknowns++;
    cons.push("Localização ainda não analisada (risco e infraestrutura).");
  } else {
    risk = Math.round(25 * (1 - i.risk.score / 100));
    const why = i.risk.reasons.slice(0, 2).join("; ");
    if (i.risk.level === "alto" || i.risk.level === "atencao") cons.push(`Índice de risco da localização ${i.risk.level === "alto" ? "alto" : "de atenção"}: ${why}.`);
    else if (i.risk.level === "moderado") cons.push(`Índice de risco moderado: ${why}.`);
    else pros.push("Índice de risco baixo segundo as bases consultadas (não substitui vistoria).");
    if (i.risk.confidence === "reduzida") unknowns++;
  }

  // Convenience around the address (15).
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

  const parts: EvalPart[] = [
    { key: "preco", label: "Preço frente a parecidos", points: Math.round(price), max: 40 },
    second,
    { key: "risco", label: "Risco da localização", points: risk, max: 25 },
    { key: "conveniencia", label: "Serviços e transporte", points: conv, max: 15 },
    { key: "imovel", label: "Imóvel e dados", points: Math.min(10, home), max: 10 },
  ];
  const score = clamp(Math.round(parts.reduce((s, p) => s + p.points, 0)), 0, 100);
  const grade = gradeOf(score);
  return { score, grade, label: GRADE_LABEL[grade], confidence: unknowns === 0 ? "alta" : unknowns === 1 ? "media" : "baixa", parts, pros, cons };
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
 * Place grade of a neighbourhood (0–100), independent of prices: location risk of its
 * analysed properties (50) and services/transport within 1 km of its centre (50).
 */
export function placeScore(i: PlaceInput): { score: number | null; grade: Grade | null; pros: string[]; cons: string[] } {
  const pros: string[] = [];
  const cons: string[] = [];
  if (i.avgRisk == null && i.nearestTransitM == null && i.supermarkets + i.pharmacies + i.hospitals + i.parks === 0) return { score: null, grade: null, pros, cons };
  let risk = 25;
  if (i.avgRisk != null) {
    risk = Math.round(50 * (1 - Math.min(100, i.avgRisk) / 100));
    if (i.avgRisk < 15) pros.push("Risco médio baixo segundo as bases consultadas");
    else if (i.avgRisk >= 35) cons.push("Risco médio da localização elevado");
  }
  if (i.floodPct != null && i.floodPct >= 30) cons.push(`${Math.round(i.floodPct)}% dos imóveis em área suscetível a inundação`);
  let services = 0;
  if (i.nearestTransitM != null && i.nearestTransitM <= 800) {
    services += 15;
    pros.push(`Metrô ou BRT a ${meters(i.nearestTransitM)} do centro`);
  } else if (i.nearestTransitM != null && i.nearestTransitM <= 1500) services += 8;
  else cons.push("Metrô ou BRT longe do centro do bairro");
  services += Math.min(5, i.transitStations) + Math.min(10, i.supermarkets * 2) + Math.min(8, i.pharmacies) + Math.min(6, i.hospitals * 3) + Math.min(6, i.parks * 2);
  if (i.supermarkets + i.pharmacies >= 6) pros.push("Bem servido de comércio essencial");
  if (i.supermarkets === 0) cons.push("Nenhum supermercado mapeado a 1 km do centro");
  const score = clamp(risk + Math.min(50, services), 0, 100);
  return { score, grade: gradeOf(score), pros, cons };
}
