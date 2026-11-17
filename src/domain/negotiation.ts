import { pctBp } from "./money";

/**
 * Negotiation reading of one offer: how much room there probably is and an offer plan
 * (opening, target, ceiling). Built only from facts the Radar measures — price against the
 * comparables' median, time on the market, earlier price cuts, how many sources carry it.
 * The base margins (buy 4%, rent 2%) are assumptions shown to the user, not market data.
 */
export type NegotiationInput = {
  mode: "aluguel" | "compra";
  /** Asking price (buy) or monthly rent (rent), cents. */
  askingCents: number | null;
  /** Price per m² against the comparables' median: positive = below the median (%). */
  priceVsMedianPct: number | null;
  daysOnMarket: number;
  /** Total cut since first seen (bp), if any. */
  totalDropBp: number | null;
  sources: number;
};

export type Negotiation = {
  leverage: "alta" | "media" | "baixa";
  discountPct: number;
  openingCents: number;
  targetCents: number;
  /** Price above which the offer stops being good against the comparables. */
  ceilingCents: number;
  reasons: string[];
  /** Advice on timing: decide fast when the price is already low, take time when it is high. */
  urgency: "decidir_rapido" | "normal" | "sem_pressa";
};

export const NEGOTIATION_NOTE =
  "Plano de proposta a partir dos dados coletados (preço frente a parecidos, tempo anunciado, reduções). As margens de base são suposições, não pesquisa de mercado; confirme com o corretor e com a documentação.";

const round100 = (c: number) => Math.round(c / 10_000) * 10_000; // R$ 100
const round10 = (c: number) => Math.round(c / 1000) * 1000; // R$ 10

export function negotiation(i: NegotiationInput): Negotiation | null {
  if (i.askingCents == null || i.askingCents <= 0) return null;
  const buy = i.mode === "compra";
  const reasons: string[] = [];
  let d = buy ? 4 : 2;
  let lever = 0;
  const pvm = i.priceVsMedianPct;
  if (pvm != null && pvm < -3) {
    const above = -pvm;
    d += Math.min(above * 0.6, buy ? 8 : 6);
    lever += above >= 10 ? 2 : 1;
    reasons.push(`Pedido ${Math.round(above)}% acima da mediana de imóveis parecidos: há espaço para argumentar com comparáveis.`);
  } else if (pvm != null && pvm >= 10) {
    d = Math.max(1, d - 3);
    lever -= 2;
    reasons.push(`Preço já ${Math.round(pvm)}% abaixo da mediana dos parecidos: pouca margem, e a oferta tende a sair rápido.`);
  } else if (pvm != null) reasons.push("Preço alinhado aos parecidos: negociação usual.");
  else reasons.push("Sem comparáveis suficientes: use a margem usual e peça referências ao anunciante.");

  if (i.daysOnMarket >= 120) {
    d += buy ? 4 : 3;
    lever += 2;
    reasons.push(`Anunciado há ${i.daysOnMarket} dias: o vendedor tende a aceitar propostas.`);
  } else if (i.daysOnMarket >= 60) {
    d += 2;
    lever += 1;
    reasons.push(`Anunciado há ${i.daysOnMarket} dias, acima do comum para uma boa oferta.`);
  } else if (i.daysOnMarket <= 7) reasons.push("Anúncio novo: o anunciante ainda não sentiu o mercado.");

  if (i.totalDropBp != null && i.totalDropBp >= 100) {
    d += 1;
    lever += 1;
    reasons.push(`Já teve redução de ${pctBp(i.totalDropBp)}: sinal de flexibilidade.`);
  }
  if (i.sources >= 3) reasons.push(`Anunciado em ${i.sources} fontes: compare as condições de cada uma.`);

  d = Math.min(buy ? 15 : 10, Math.max(1, Math.round(d * 10) / 10));
  const r = buy ? round100 : round10;
  const target = r(i.askingCents * (1 - d / 100));
  const opening = r(i.askingCents * (1 - Math.min(buy ? 20 : 12, d * 1.6) / 100));
  const fair = pvm != null ? i.askingCents * (1 + pvm / 100) : i.askingCents;
  const ceiling = r(Math.min(i.askingCents, Math.max(target, fair)));
  return {
    leverage: lever >= 3 ? "alta" : lever >= 1 ? "media" : "baixa",
    discountPct: d,
    openingCents: opening,
    targetCents: target,
    ceilingCents: ceiling,
    reasons,
    urgency: pvm != null && pvm >= 10 ? "decidir_rapido" : lever >= 3 ? "sem_pressa" : "normal",
  };
}

export const LEVERAGE_LABEL: Record<Negotiation["leverage"], string> = { alta: "Margem alta", media: "Margem média", baixa: "Margem baixa" };
export const URGENCY_LABEL: Record<Negotiation["urgency"], string> = {
  decidir_rapido: "Decida rápido: preço abaixo dos parecidos",
  normal: "Ritmo normal de negociação",
  sem_pressa: "Sem pressa: o tempo joga a seu favor",
};
