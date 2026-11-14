import { brl, m2, meters, pctBp } from "@/domain/money";
import type { NeighborhoodStats } from "@/server/queries/neighborhoods";

export type Col = {
  key: string;
  label: string;
  short?: string;
  value: (n: NeighborhoodStats) => number | null;
  show: (n: NeighborhoodStats) => string;
  /** Which end is better (for highlights in the comparison). */
  better?: "min" | "max";
  help?: string;
};

const pct = (v: number | null) => (v == null ? "—" : `${v}%`);

const RENT_ONLY = new Set(["rent", "total", "m2", "partial"]);
const BUY_ONLY = new Set(["price", "pricem2", "yield", "partialBuy"]);

/** Columns of each mode: rent compares monthly costs; buy compares prices, price per m² and yield. */
export function columnsFor(mode: "aluguel" | "compra"): Col[] {
  return COLUMNS.filter((c) => (mode === "compra" ? !RENT_ONLY.has(c.key) : !BUY_ONLY.has(c.key)));
}

export const COLUMNS: Col[] = [
  { key: "place", label: "Nota do local (risco + serviços)", short: "Local", value: (n) => n.place.score, show: (n) => (n.place.score == null ? "—" : `${n.place.grade} · ${n.place.score}`), better: "max", help: "Risco médio dos imóveis analisados e serviços e transporte a 1 km do centro do bairro; não depende de preço." },
  { key: "eval", label: "Avaliação média das ofertas", short: "Ofertas", value: (n) => n.avgEval, show: (n) => (n.avgEval == null ? "—" : `${n.avgEval} · ${n.goodOffers} B+`), better: "max", help: "Média da avaliação do Radar dos imóveis do bairro neste modo e quantos têm nota B ou melhor." },
  { key: "count", label: "Imóveis ativos", short: "Imóveis", value: (n) => n.count, show: (n) => String(n.count), better: "max" },
  { key: "rent", label: "Aluguel mediano", short: "Aluguel", value: (n) => n.medianRentCents, show: (n) => brl(n.medianRentCents), better: "min" },
  { key: "total", label: "Custo total mediano", short: "Total", value: (n) => n.medianTotalCents, show: (n) => brl(n.medianTotalCents), better: "min" },
  { key: "m2", label: "Custo total por m² (mediana)", short: "R$/m²", value: (n) => n.medianCostM2Cents, show: (n) => (n.medianCostM2Cents == null ? "—" : `${brl(n.medianCostM2Cents)}`), better: "min" },
  { key: "price", label: "Preço de venda mediano", short: "Preço", value: (n) => n.medianPriceCents, show: (n) => brl(n.medianPriceCents), better: "min" },
  { key: "pricem2", label: "Preço por m² (mediana)", short: "R$/m²", value: (n) => n.medianPriceM2Cents, show: (n) => brl(n.medianPriceM2Cents), better: "min" },
  { key: "yield", label: "Rendimento bruto estimado (mediana)", short: "Rend.", value: (n) => n.medianYieldBp, show: (n) => (n.medianYieldBp == null ? "—" : `${pctBp(n.medianYieldBp)}`), better: "max", help: "Aluguel estimado por comparáveis × 12 ÷ preço, por imóvel; aqui, a mediana do bairro." },
  { key: "partialBuy", label: "Sem condomínio ou IPTU informado", short: "Parcial", value: (n) => n.partialPct, show: (n) => pct(n.partialPct), better: "min" },
  { key: "area", label: "Área média", short: "Área", value: (n) => n.avgAreaM2, show: (n) => m2(n.avgAreaM2), better: "max" },
  { key: "partial", label: "Anúncios com custo parcial", short: "Parcial", value: (n) => n.partialPct, show: (n) => pct(n.partialPct), better: "min", help: "Sem condomínio ou IPTU informado: o custo real pode ser maior." },
  { key: "transit", label: "Metrô/BRT mais próximo do centro", short: "Transporte", value: (n) => n.nearestTransitM, show: (n) => meters(n.nearestTransitM), better: "min" },
  { key: "stations", label: "Estações (metrô/ônibus) a 1 km", short: "Estações", value: (n) => n.transitStations, show: (n) => String(n.transitStations), better: "max" },
  { key: "hospitals", label: "Hospitais a 1 km", short: "Hospitais", value: (n) => n.hospitals, show: (n) => String(n.hospitals), better: "max" },
  { key: "markets", label: "Supermercados a 1 km", short: "Mercados", value: (n) => n.supermarkets, show: (n) => String(n.supermarkets), better: "max" },
  { key: "pharmacies", label: "Farmácias a 1 km", short: "Farmácias", value: (n) => n.pharmacies, show: (n) => String(n.pharmacies), better: "max" },
  { key: "parks", label: "Parques e áreas verdes a 1 km", short: "Parques", value: (n) => n.parks, show: (n) => String(n.parks), better: "max" },
  { key: "flood", label: "Imóveis em suscetibilidade a inundação", short: "Inundação", value: (n) => n.floodPct, show: (n) => pct(n.floodPct), better: "min", help: "Parcela dos imóveis analisados dentro de áreas suscetíveis (SGB/IPT)." },
  { key: "risk", label: "Índice de risco médio", short: "Risco", value: (n) => n.avgRisk, show: (n) => (n.avgRisk == null ? "—" : String(n.avgRisk)), better: "min" },
];
