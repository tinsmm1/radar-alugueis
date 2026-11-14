import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { properties } from "@/db/schema";
import type { LocationFacts } from "@/domain/risk";

/** Same limit as the client store in src/lib/compare.ts (a "use client" module cannot export values to the server). */
import { COMPARE_MAX } from "@/lib/compare-limit";

export const COMPARE_LIMIT = COMPARE_MAX;

export type CompareItem = {
  id: number;
  title: string | null;
  type: string | null;
  photo: string | null;
  neighborhood: string | null;
  regional: string | null;
  street: string | null;
  rentCents: number | null;
  salePriceCents: number | null;
  salePriceM2Cents: number | null;
  estRentCents: number | null;
  grossYieldBp: number | null;
  forRent: boolean;
  forSale: boolean;
  condoCents: number | null;
  iptuMonthlyCents: number | null;
  totalCents: number | null;
  costStatus: string | null;
  costPerM2Cents: number | null;
  areaM2: number | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking: number | null;
  features: string[];
  geoPrecision: string | null;
  riskScore: number | null;
  riskLevel: string | null;
  floodLevel: number | null;
  landslideLevel: number | null;
  transitM: number | null;
  transitName: string | null;
  isDemo: boolean;
  status: string;
  rentEvalScore: number | null;
  saleEvalScore: number | null;
};

/** Up to COMPARE_LIMIT properties in the requested order (unknown ids are dropped). */
export async function compareItems(ids: number[]): Promise<CompareItem[]> {
  const wanted = [...new Set(ids.filter((i) => Number.isInteger(i) && i > 0))].slice(0, COMPARE_LIMIT);
  if (!wanted.length) return [];
  const rows = await getDb().select().from(properties).where(inArray(properties.id, wanted));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return wanted
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => {
      const f = r.analysis as LocationFacts | null;
      const metro = f?.nearest?.metro ?? null;
      const bus = f?.nearest?.estacao_onibus ?? null;
      const transit = [metro && { ...metro, label: "metrô" }, bus && { ...bus, label: "BRT/ônibus" }].filter(Boolean).sort((a, b) => a!.distanceM - b!.distanceM)[0] ?? null;
      return {
        id: r.id, title: r.title, type: r.type, photo: r.photo, neighborhood: r.neighborhood, regional: r.regional, street: r.street,
        rentCents: r.rentCents, salePriceCents: r.salePriceCents, salePriceM2Cents: r.salePriceM2Cents, estRentCents: r.estRentCents, grossYieldBp: r.grossYieldBp,
        forRent: r.forRent, forSale: r.forSale, condoCents: r.condoCents, iptuMonthlyCents: r.iptuMonthlyCents, totalCents: r.totalCents, costStatus: r.costStatus,
        costPerM2Cents: r.costPerM2Cents, areaM2: r.areaM2, bedrooms: r.bedrooms, suites: r.suites, bathrooms: r.bathrooms, parking: r.parking,
        features: r.features, geoPrecision: r.geoPrecision, riskScore: r.riskScore, riskLevel: r.riskLevel, floodLevel: f?.flood?.insideLevel ?? null,
        landslideLevel: f?.landslide?.insideLevel ?? null, transitM: transit?.distanceM ?? null,
        transitName: transit ? `${transit.label}${transit.name ? ` ${transit.name}` : ""}` : null, isDemo: r.isDemo, status: r.status, rentEvalScore: r.rentEvalScore, saleEvalScore: r.saleEvalScore,
      };
    });
}
