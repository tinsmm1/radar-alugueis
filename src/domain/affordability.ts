import { acquisition, DEFAULT_ASSUMPTIONS, finance, monthlyRate, type Assumptions } from "./purchase";
import type { Profile } from "./profile";

/**
 * Does this home fit the household? Uses the owner's income and savings (Perfil e trabalho)
 * and the purchase assumptions: cash needed up front (down payment + ITBI + registry) against
 * savings, and the first SAC installment (the highest one) against the share of income banks
 * usually accept (~30% in Brazil, editable). For renting, the known monthly total against income.
 * A reading for planning, not a credit analysis.
 */
export type Fit = "cabe" | "apertado" | "nao_cabe" | "sem_dados";
export const FIT_LABEL: Record<Fit, string> = { cabe: "Cabe no orçamento", apertado: "Apertado", nao_cabe: "Não cabe hoje", sem_dados: "Informe renda e reserva" };
export const AFFORDABILITY_NOTE =
  "Leitura de planejamento com base na renda e reserva informadas em Perfil e trabalho e nas suposições da simulação. Não é análise de crédito: cada banco aplica regras próprias.";

export type BuyAffordability = {
  fit: Fit;
  upfrontCents: number;
  savingsGapCents: number | null;
  firstInstallmentCents: number;
  housingMonthlyCents: number;
  installmentPctOfIncome: number | null;
  /** Highest price the household could buy today (limited by income or by savings). */
  maxPriceCents: number | null;
  limitedBy: "renda" | "reserva" | null;
  reasons: string[];
};

export function maxPriceFor(p: Profile, a: Assumptions = DEFAULT_ASSUMPTIONS): { cents: number | null; limitedBy: "renda" | "reserva" | null } {
  const n = a.years * 12;
  const byIncome = p.monthlyIncomeCents ? (p.monthlyIncomeCents * (p.maxInstallmentPct / 100)) / ((1 - a.downPct / 100) * (1 / n + monthlyRate(a.annualRatePct))) : null;
  const bySavings = p.savingsCents != null ? p.savingsCents / ((a.downPct + a.itbiPct + a.registryPct) / 100) : null;
  if (byIncome == null && bySavings == null) return { cents: null, limitedBy: null };
  if (byIncome == null) return { cents: Math.round(bySavings!), limitedBy: "reserva" };
  if (bySavings == null) return { cents: Math.round(byIncome), limitedBy: "renda" };
  return byIncome <= bySavings ? { cents: Math.round(byIncome), limitedBy: "renda" } : { cents: Math.round(bySavings), limitedBy: "reserva" };
}

export function buyAffordability(priceCents: number, condoCents: number | null, iptuMonthlyCents: number | null, p: Profile, a: Assumptions = DEFAULT_ASSUMPTIONS): BuyAffordability {
  const acq = acquisition(priceCents, a);
  const loan = finance(priceCents - acq.downCents, a.annualRatePct, a.years, "sac");
  const housing = loan.firstPaymentCents + (condoCents ?? 0) + (iptuMonthlyCents ?? 0);
  const reasons: string[] = [];
  const pct = p.monthlyIncomeCents ? Math.round((loan.firstPaymentCents / p.monthlyIncomeCents) * 1000) / 10 : null;
  const gap = p.savingsCents != null ? acq.upfrontCents - p.savingsCents : null;
  const max = maxPriceFor(p, a);
  let fit: Fit = "sem_dados";
  if (pct != null || gap != null) {
    const incomeOk = pct == null ? null : pct <= p.maxInstallmentPct ? "ok" : pct <= p.maxInstallmentPct + 5 ? "tight" : "no";
    const cashOk = gap == null ? null : gap <= 0 ? "ok" : gap <= acq.upfrontCents * 0.1 ? "tight" : "no";
    const states = [incomeOk, cashOk].filter(Boolean);
    fit = states.includes("no") ? "nao_cabe" : states.includes("tight") ? "apertado" : "cabe";
    if (pct != null) reasons.push(`Primeira parcela (SAC) de ${pct.toLocaleString("pt-BR")}% da renda; o limite usual é ${p.maxInstallmentPct}%.`);
    if (gap != null) reasons.push(gap <= 0 ? "A reserva cobre entrada, ITBI e cartório." : "A reserva não cobre entrada, ITBI e cartório.");
    if (condoCents == null || iptuMonthlyCents == null) reasons.push("Condomínio ou IPTU não informados: o custo mensal pode ser maior.");
  }
  return { fit, upfrontCents: acq.upfrontCents, savingsGapCents: gap, firstInstallmentCents: loan.firstPaymentCents, housingMonthlyCents: housing, installmentPctOfIncome: pct, maxPriceCents: max.cents, limitedBy: max.limitedBy, reasons };
}

/** Renting: known monthly total (+ commute money) against income; 30% is the usual reference. */
export function rentAffordability(totalCents: number | null, commuteCents: number | null, p: Profile): { fit: Fit; pctOfIncome: number | null; withCommutePct: number | null } {
  if (!p.monthlyIncomeCents || totalCents == null) return { fit: "sem_dados", pctOfIncome: null, withCommutePct: null };
  const pct = Math.round((totalCents / p.monthlyIncomeCents) * 1000) / 10;
  const withCommute = commuteCents != null ? Math.round(((totalCents + commuteCents) / p.monthlyIncomeCents) * 1000) / 10 : null;
  const fit: Fit = pct <= p.maxInstallmentPct ? "cabe" : pct <= p.maxInstallmentPct + 5 ? "apertado" : "nao_cabe";
  return { fit, pctOfIncome: pct, withCommutePct: withCommute };
}
