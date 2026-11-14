import { normalizeText } from "./text";

/** Median of numbers (null for an empty list). */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
}

export type Comparable = {
  id: number;
  neighborhood: string | null;
  regional: string | null;
  type: string | null;
  bedrooms: number | null;
  /** Known monthly total per m² (cents). */
  costPerM2: number | null;
};

const TYPE_GROUP: Record<string, string> = { casa: "casa", casa_condominio: "casa", kitnet: "compacto", loft: "compacto" };
const typeGroup = (t: string | null) => TYPE_GROUP[t ?? ""] ?? "apto";
const band = (b: number | null) => (b == null ? "?" : b >= 4 ? "4+" : String(b));

/** Comparables share neighbourhood (or regional), type group and bedroom band. */
export function comparableKeys(c: Comparable): { bairro: string; regional: string; regionalAny: string } {
  const tail = `${typeGroup(c.type)}|${band(c.bedrooms)}`;
  return { bairro: `b:${normalizeText(c.neighborhood)}|${tail}`, regional: `r:${normalizeText(c.regional)}|${tail}`, regionalAny: `ra:${normalizeText(c.regional)}` };
}

export type ComparableStats = Map<string, number[]>;

/** Collects cost/m² per comparable key from the active market. */
export function buildStats(items: Comparable[]): ComparableStats {
  const stats: ComparableStats = new Map();
  for (const c of items) {
    if (c.costPerM2 == null) continue;
    const { bairro, regional, regionalAny } = comparableKeys(c);
    if (c.neighborhood) stats.set(bairro, [...(stats.get(bairro) ?? []), c.costPerM2]);
    if (c.regional) stats.set(regional, [...(stats.get(regional) ?? []), c.costPerM2]);
    if (c.regional) stats.set(regionalAny, [...(stats.get(regionalAny) ?? []), c.costPerM2]);
  }
  return stats;
}

export const MIN_COMPARABLES = 5;
export const BELOW_MARKET = 0.15;

export type BelowMarket = { pctBelow: number; medianCostPerM2: number; comparables: number; scope: "bairro" | "regional" };

/** Cost/m² at least 15% below the median of ≥5 comparables (itself excluded); bairro first, then regional. */
export function belowMarket(c: Comparable, stats: ComparableStats): BelowMarket | null {
  if (c.costPerM2 == null) return null;
  const keys = comparableKeys(c);
  for (const [scope, key] of [["bairro", keys.bairro], ["regional", keys.regional]] as const) {
    const values = [...(stats.get(key) ?? [])];
    const idx = values.indexOf(c.costPerM2);
    if (idx >= 0) values.splice(idx, 1);
    if (values.length < MIN_COMPARABLES) continue;
    const med = median(values)!;
    const below = (med - c.costPerM2) / med;
    return below >= BELOW_MARKET ? { pctBelow: Math.round(below * 1000) / 10, medianCostPerM2: med, comparables: values.length, scope } : null;
  }
  return null;
}

/** Median of the comparables (bairro first, then regional), itself excluded; null with fewer than MIN_COMPARABLES. */
export function comparableMedian(c: Comparable, stats: ComparableStats, exclude = true): { median: number; comparables: number; scope: "bairro" | "regional" | "regional_todos" } | null {
  const keys = comparableKeys(c);
  // Same bairro, type and bedrooms; then same regional; finally the whole regional (any type).
  for (const [scope, key] of [["bairro", keys.bairro], ["regional", keys.regional], ["regional_todos", keys.regionalAny]] as const) {
    const values = [...(stats.get(key) ?? [])];
    if (exclude && c.costPerM2 != null) {
      const idx = values.indexOf(c.costPerM2);
      if (idx >= 0) values.splice(idx, 1);
    }
    if (values.length >= MIN_COMPARABLES) return { median: median(values)!, comparables: values.length, scope };
  }
  return null;
}

/** Gross yield (bp) considered high for Belo Horizonte residential sales. */
export const HIGH_YIELD_BP = 600;

export type OpportunitySignal =
  | { kind: "baixa_preco"; dropBp: number; at: string }
  | ({ kind: "abaixo_mercado" } & BelowMarket)
  | { kind: "recente"; hours: number }
  | { kind: "alto_rendimento"; yieldBp: number };

export const SIGNAL_LABEL: Record<OpportunitySignal["kind"], string> = {
  baixa_preco: "Preço reduzido",
  abaixo_mercado: "Abaixo dos comparáveis",
  recente: "Recém-publicado",
  alto_rendimento: "Alto rendimento",
};

export const RECENT_HOURS = 48;

/** Signals and a 0–100 score (drop %, distance below market, freshness). */
export function opportunity(input: { dropBp: number | null; droppedAt: Date | null; firstSeenAt: Date; below: BelowMarket | null; yieldBp?: number | null }, now: Date): { signals: OpportunitySignal[]; score: number } {
  const signals: OpportunitySignal[] = [];
  let score = 0;
  if (input.dropBp && input.dropBp >= 100 && input.droppedAt && now.getTime() - input.droppedAt.getTime() <= 30 * 86_400_000) {
    signals.push({ kind: "baixa_preco", dropBp: input.dropBp, at: input.droppedAt.toISOString() });
    score += Math.min(40, (input.dropBp / 100) * 2);
  }
  if (input.below) {
    signals.push({ kind: "abaixo_mercado", ...input.below });
    score += Math.min(45, input.below.pctBelow * 1.5);
  }
  if (input.yieldBp != null && input.yieldBp >= HIGH_YIELD_BP) {
    signals.push({ kind: "alto_rendimento", yieldBp: input.yieldBp });
    score += Math.min(30, (input.yieldBp - HIGH_YIELD_BP) / 20 + 10);
  }
  const hours = Math.floor((now.getTime() - input.firstSeenAt.getTime()) / 3_600_000);
  if (hours <= RECENT_HOURS) {
    signals.push({ kind: "recente", hours });
    score += 15;
  }
  return { signals, score: Math.min(100, Math.round(score)) };
}
