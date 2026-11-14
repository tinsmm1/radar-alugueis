import type { IptuPeriod } from "./listing";

export type CostInput = {
  rentCents: number | null;
  condoCents: number | null;
  iptuCents: number | null;
  iptuPeriod: IptuPeriod | null;
  otherFeesCents: number | null;
};

export type CostStatus = "completo" | "parcial" | "desconhecido";

export type MonthlyCost = {
  rentCents: number | null;
  condoCents: number | null;
  /** IPTU per month (annual / 12, rounded to the cent). */
  iptuMonthlyCents: number | null;
  otherFeesCents: number | null;
  /** Condo + IPTU + other fees that are known. */
  extrasCents: number;
  /** Rent + every known component. Null only when the rent itself is unknown. */
  totalKnownCents: number | null;
  status: CostStatus;
  /** Components that were not informed (never counted as zero). */
  missing: Array<"aluguel" | "condomínio" | "IPTU">;
};

/**
 * Known monthly cost = rent + condo + IPTU per month + known recurring fees.
 * - IPTU informed per year is divided by 12; with an unknown period, a value above 3× the rent
 *   or above R$ 2.000 is taken as annual (listings commonly omit the period).
 * - A missing condo or IPTU makes the cost "parcial", never zero. Houses and kitnets often have
 *   no condo, but only the source can say "isento" (condoCents = 0).
 * - Other fees are optional extras: unknown fees do not make the cost partial.
 */
export function monthlyCost(c: CostInput): MonthlyCost {
  const iptuMonthlyCents = c.iptuCents == null ? null : iptuPerMonth(c.iptuCents, c.iptuPeriod, c.rentCents);
  const missing: MonthlyCost["missing"] = [];
  if (c.rentCents == null) missing.push("aluguel");
  if (c.condoCents == null) missing.push("condomínio");
  if (iptuMonthlyCents == null) missing.push("IPTU");
  const extrasCents = (c.condoCents ?? 0) + (iptuMonthlyCents ?? 0) + (c.otherFeesCents ?? 0);
  const totalKnownCents = c.rentCents == null ? null : c.rentCents + extrasCents;
  const status: CostStatus = c.rentCents == null ? "desconhecido" : missing.length ? "parcial" : "completo";
  return { rentCents: c.rentCents, condoCents: c.condoCents, iptuMonthlyCents, otherFeesCents: c.otherFeesCents, extrasCents, totalKnownCents, status, missing };
}

export function iptuPerMonth(iptuCents: number, period: IptuPeriod | null, rentCents: number | null): number {
  const annual = period === "anual" || (period == null && (iptuCents > 200_000 || (rentCents != null && iptuCents > rentCents * 3)));
  return annual ? Math.round(iptuCents / 12) : iptuCents;
}

/** Cost per m² (cents per m²) of the known monthly total; null without both values. */
export function costPerM2(totalCents: number | null, areaM2: number | null): number | null {
  return totalCents == null || !areaM2 ? null : Math.round(totalCents / areaM2);
}

export const COST_STATUS_LABEL: Record<CostStatus, string> = {
  completo: "Custo completo",
  parcial: "Custo parcial",
  desconhecido: "Custo não informado",
};
