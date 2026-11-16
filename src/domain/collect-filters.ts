import { z } from "zod";
import type { NormalizedListing, PropertyType } from "./listing";
import { normalizeText } from "./text";

/** Regionais of Belo Horizonte (same names as the regional layer). */
export const BH_REGIONAIS = ["Barreiro", "Centro-Sul", "Leste", "Nordeste", "Noroeste", "Norte", "Oeste", "Pampulha", "Venda Nova"] as const;

/** Residential groups the owner can collect. Commercial property is never collected. */
export const COLLECT_TYPES = ["apartamento", "casa"] as const;
export type CollectType = (typeof COLLECT_TYPES)[number];
export const COLLECT_TYPE_LABEL: Record<CollectType, string> = { apartamento: "Apartamentos", casa: "Casas" };

const TYPE_GROUP: Record<PropertyType, CollectType> = {
  apartamento: "apartamento",
  cobertura: "apartamento",
  area_privativa: "apartamento",
  loft: "apartamento",
  kitnet: "apartamento",
  duplex: "apartamento",
  casa: "casa",
  casa_condominio: "casa",
};

/** ZAP/Viva Real unit types sent to the robot for each group. */
const UNIT_TYPES: Record<CollectType, string[]> = { apartamento: ["APARTMENT"], casa: ["HOME", "CONDOMINIUM"] };

const reais = z.int().min(0).max(100_000_000).nullable().default(null);

/** Filters applied by the robot itself (saves credit) and checked again on import. Prices in whole reais. */
export const collectFiltersSchema = z.object({
  tipos: z.array(z.enum(COLLECT_TYPES)).min(1, "Escolha apartamentos, casas ou os dois.").default([...COLLECT_TYPES]),
  aluguelMin: reais,
  aluguelMax: reais,
  vendaMin: reais,
  vendaMax: reais,
  quartosMin: z.int().min(1).max(10).nullable().default(null),
  regionais: z.array(z.enum(BH_REGIONAIS)).max(BH_REGIONAIS.length).default([]),
});
export type CollectFilters = z.infer<typeof collectFiltersSchema>;

export const DEFAULT_COLLECT_FILTERS: CollectFilters = collectFiltersSchema.parse({});

/** Stored JSON → filters; anything invalid falls back to the default (collect everything). */
export function readCollectFilters(raw: unknown): CollectFilters {
  const res = collectFiltersSchema.safeParse(raw ?? {});
  return res.success ? res.data : DEFAULT_COLLECT_FILTERS;
}

export function isDefaultFilters(f: CollectFilters): boolean {
  return f.tipos.length === COLLECT_TYPES.length && f.aluguelMin == null && f.aluguelMax == null && f.vendaMin == null && f.vendaMax == null && f.quartosMin == null && f.regionais.length === 0;
}

export type Business = "RENTAL" | "SALE" | null;

/** Input fields sent with each robot run (merged over the task's own input). */
export function actorInput(f: CollectFilters, business: Business): Record<string, unknown> {
  const input: Record<string, unknown> = { unitTypes: f.tipos.flatMap((t) => UNIT_TYPES[t]) };
  const [min, max] = business === "SALE" ? [f.vendaMin, f.vendaMax] : business === "RENTAL" ? [f.aluguelMin, f.aluguelMax] : [null, null];
  if (min != null && min > 0) input.minPrice = min;
  if (max != null && max > 0) input.maxPrice = max;
  if (f.quartosMin != null) input.minBedrooms = f.quartosMin;
  return input;
}

const inRange = (cents: number | null, min: number | null, max: number | null) =>
  cents == null || ((min == null || cents >= min * 100) && (max == null || max === 0 || cents <= max * 100));

/**
 * Import-time check of the same filters (and of the regional, which the robot cannot filter).
 * Unknown values never exclude a listing, except a type outside the chosen groups.
 */
export function keepListing(l: NormalizedListing, f: CollectFilters, regionalOf: (bairro: string) => string | null): boolean {
  const group = l.type ? TYPE_GROUP[l.type] : null;
  if (group && !f.tipos.includes(group)) return false;
  if (f.quartosMin != null && l.bedrooms != null && l.bedrooms < f.quartosMin) return false;
  // A listing offered for rent and for sale stays when at least one of its prices fits.
  const rentOk = l.purposes.includes("aluguel") && inRange(l.rentCents, f.aluguelMin, f.aluguelMax);
  const saleOk = l.purposes.includes("compra") && inRange(l.salePriceCents, f.vendaMin, f.vendaMax);
  if (!rentOk && !saleOk) return false;
  if (f.regionais.length && l.neighborhood) {
    const regional = regionalOf(normalizeText(l.neighborhood));
    if (regional && !(f.regionais as string[]).includes(regional)) return false;
  }
  return true;
}

/** Short pt-BR summary for the admin page. */
export function describeFilters(f: CollectFilters): string {
  if (isDefaultFilters(f)) return "Padrão: coleta todos os apartamentos e casas de Belo Horizonte.";
  const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;
  const range = (min: number | null, max: number | null) => (min && max ? `${brl(min)} a ${brl(max)}` : min ? `a partir de ${brl(min)}` : max ? `até ${brl(max)}` : null);
  return [
    f.tipos.map((t) => COLLECT_TYPE_LABEL[t]).join(" e "),
    range(f.aluguelMin, f.aluguelMax) && `aluguel ${range(f.aluguelMin, f.aluguelMax)}`,
    range(f.vendaMin, f.vendaMax) && `venda ${range(f.vendaMin, f.vendaMax)}`,
    f.quartosMin && `${f.quartosMin}+ quartos`,
    f.regionais.length && `regionais ${f.regionais.join(", ")}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
