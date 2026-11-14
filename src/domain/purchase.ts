/**
 * Buying analysis: acquisition costs, financing (SAC and Price), monthly cost of owning,
 * buy vs rent, and gross rental yield. Every rate is an editable assumption shown to the user;
 * nothing here is a quote from a bank or the city.
 */

export type Assumptions = {
  /** Down payment, % of the price (banks usually require ≥ 20%). */
  downPct: number;
  /** Effective annual interest rate of the loan, % (assumption; varies by bank and profile). */
  annualRatePct: number;
  /** Loan term in years. */
  years: number;
  /** ITBI rate, % (Belo Horizonte: 3% of the transaction value; confirm with the city). */
  itbiPct: number;
  /** Deed and registry, % of the price (estimate of notary fees). */
  registryPct: number;
  /** Annual return the down payment would earn if invested, % (opportunity cost). */
  investReturnPct: number;
  /** Yearly upkeep, % of the price (paint, repairs; 0 to ignore). */
  upkeepPct: number;
};

export const DEFAULT_ASSUMPTIONS: Assumptions = { downPct: 20, annualRatePct: 11, years: 30, itbiPct: 3, registryPct: 1.5, investReturnPct: 10, upkeepPct: 0.5 };

export const ASSUMPTION_NOTE =
  "Simulação com suposições editáveis (juros, entrada, prazo, ITBI de BH de 3%, cartório). Não é proposta de banco nem cálculo oficial de impostos.";

/** Effective annual rate (%) → monthly rate (fraction). */
export function monthlyRate(annualPct: number): number {
  return (1 + annualPct / 100) ** (1 / 12) - 1;
}

export type Financing = {
  system: "sac" | "price";
  financedCents: number;
  months: number;
  firstPaymentCents: number;
  lastPaymentCents: number;
  totalInterestCents: number;
  totalPaidCents: number;
};

/** SAC: constant amortization, decreasing payments. Price: constant payments. Rounded to cents. */
export function finance(principalCents: number, annualPct: number, years: number, system: "sac" | "price"): Financing {
  const n = Math.max(1, Math.round(years * 12));
  const i = monthlyRate(annualPct);
  if (principalCents <= 0) return { system, financedCents: 0, months: n, firstPaymentCents: 0, lastPaymentCents: 0, totalInterestCents: 0, totalPaidCents: 0 };
  if (system === "price") {
    const pmt = i === 0 ? principalCents / n : (principalCents * i) / (1 - (1 + i) ** -n);
    const total = Math.round(pmt * n);
    return { system, financedCents: principalCents, months: n, firstPaymentCents: Math.round(pmt), lastPaymentCents: Math.round(pmt), totalInterestCents: total - principalCents, totalPaidCents: total };
  }
  const amort = principalCents / n;
  // Interest over the whole term: i × amort × (n + (n-1) + … + 1) = i × amort × n(n+1)/2.
  const interest = i * amort * ((n * (n + 1)) / 2);
  return {
    system, financedCents: principalCents, months: n,
    firstPaymentCents: Math.round(amort + principalCents * i),
    lastPaymentCents: Math.round(amort + amort * i),
    totalInterestCents: Math.round(interest),
    totalPaidCents: Math.round(principalCents + interest),
  };
}

export type Acquisition = { itbiCents: number; registryCents: number; downCents: number; upfrontCents: number };

/** Cash needed at purchase: down payment + ITBI + deed/registry. */
export function acquisition(priceCents: number, a: Assumptions): Acquisition {
  const itbiCents = Math.round((priceCents * a.itbiPct) / 100);
  const registryCents = Math.round((priceCents * a.registryPct) / 100);
  const downCents = Math.round((priceCents * a.downPct) / 100);
  return { itbiCents, registryCents, downCents, upfrontCents: itbiCents + registryCents + downCents };
}

export type OwnershipMonthly = { condoCents: number | null; iptuMonthlyCents: number | null; upkeepCents: number; knownCents: number; partial: boolean };

/** Recurring cost of owning (without the loan): condo + IPTU + upkeep. Unknown stays unknown. */
export function ownershipMonthly(priceCents: number, condoCents: number | null, iptuMonthlyCents: number | null, a: Assumptions): OwnershipMonthly {
  const upkeepCents = Math.round((priceCents * a.upkeepPct) / 100 / 12);
  return { condoCents, iptuMonthlyCents, upkeepCents, knownCents: (condoCents ?? 0) + (iptuMonthlyCents ?? 0) + upkeepCents, partial: condoCents == null || iptuMonthlyCents == null };
}

export type BuyVsRent = {
  /** First month buying with financing: payment + ownership costs. */
  buyMonthlyCents: number;
  /** Renting an equivalent home: estimated rent + condo + IPTU. */
  rentMonthlyCents: number | null;
  /** What the down payment and purchase costs would earn per month if invested. */
  opportunityCostCents: number;
  /** buy − rent (positive: buying costs more per month at the start). */
  differenceCents: number | null;
  /** Years of rent that pay the price (price ÷ annual rent). */
  priceToRentYears: number | null;
};

export function buyVsRent(priceCents: number, condoCents: number | null, iptuMonthlyCents: number | null, estRentCents: number | null, a: Assumptions, system: "sac" | "price" = "sac"): BuyVsRent {
  const acq = acquisition(priceCents, a);
  const loan = finance(priceCents - acq.downCents, a.annualRatePct, a.years, system);
  const own = ownershipMonthly(priceCents, condoCents, iptuMonthlyCents, a);
  const buyMonthlyCents = loan.firstPaymentCents + own.knownCents;
  const rentMonthlyCents = estRentCents == null ? null : estRentCents + (condoCents ?? 0) + (iptuMonthlyCents ?? 0);
  const opportunityCostCents = Math.round(acq.upfrontCents * monthlyRate(a.investReturnPct));
  return {
    buyMonthlyCents, rentMonthlyCents, opportunityCostCents,
    differenceCents: rentMonthlyCents == null ? null : buyMonthlyCents - rentMonthlyCents,
    priceToRentYears: estRentCents ? Math.round((priceCents / (estRentCents * 12)) * 10) / 10 : null,
  };
}

/** Gross yield in basis points: annual rent ÷ price. */
export function grossYieldBp(estRentCents: number | null, priceCents: number | null): number | null {
  return estRentCents && priceCents ? Math.round(((estRentCents * 12) / priceCents) * 10_000) : null;
}

/** Price per m² (cents/m²). */
export function pricePerM2(priceCents: number | null, areaM2: number | null): number | null {
  return priceCents == null || !areaM2 ? null : Math.round(priceCents / areaM2);
}
