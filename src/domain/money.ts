/** Money is integer cents everywhere; areas are m² (decimal). */

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const BRL_CENTS = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** R$ 2.500 (no cents, for cards); null → "—". */
export function brl(cents: number | null | undefined): string {
  return cents == null ? "—" : BRL.format(Math.round(cents / 100)).replace(/ /g, " ");
}

/** R$ 2.500,00 (with cents, for breakdowns). */
export function brlCents(cents: number | null | undefined): string {
  return cents == null ? "—" : BRL_CENTS.format(cents / 100).replace(/ /g, " ");
}

export function m2(value: number | null | undefined): string {
  return value == null ? "—" : `${NUM.format(value)} m²`;
}

export function num(value: number | null | undefined, digits = 1): string {
  return value == null ? "—" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
}

/** Basis points (hundredths of a percent) → "12,5%". */
export function pctBp(bp: number | null | undefined): string {
  return bp == null ? "—" : `${num(bp / 100)}%`;
}

/** Distance in metres → "180 m" / "1,2 km". */
export function meters(value: number | null | undefined): string {
  if (value == null) return "—";
  return value < 1000 ? `${Math.round(value / 10) * 10} m` : `${num(value / 1000)} km`;
}

/**
 * Parses Brazilian and plain money text into cents: "R$ 2.500,00", "2500", "2.500", "2500.50",
 * "1,5 mil". Returns null for empty, zero-like placeholders ("consulte", "-") and negatives.
 */
export function parseMoney(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
  if (typeof input !== "string") return null;
  let s = input.trim().toLowerCase().replace(/r\$|brl|\s/g, "");
  if (!s || !/\d/.test(s)) return null;
  let factor = 1;
  if (s.endsWith("mil")) {
    factor = 1000;
    s = s.slice(0, -3);
  }
  // "2.500,00" → 2500.00 ; "2,500.00" → 2500.00 ; "2.500" → 2500 ; "2500,5" → 2500.5
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma && lastComma >= 0) s = s.replace(/,/g, "");
  else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const value = Number(s) * factor;
  return Number.isFinite(value) && value >= 0 && value < 1e8 ? Math.round(value * 100) : null;
}

/** "75,5 m²", "75.5", "75" → 75.5 ; nonsense or out of range → null. */
export function parseArea(input: unknown): number | null {
  const raw = typeof input === "number" ? input : typeof input === "string" ? Number(input.replace(/m²|m2|\s/gi, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) : NaN;
  return Number.isFinite(raw) && raw > 5 && raw < 100_000 ? Math.round(raw * 100) / 100 : null;
}

/** Small counts (rooms, parking): "2", 2, "2 quartos" → 2 ; out of 0..50 → null. */
export function parseCount(input: unknown): number | null {
  const raw = typeof input === "number" ? input : typeof input === "string" ? Number((/\d+/.exec(input) ?? [""])[0] || NaN) : NaN;
  return Number.isInteger(raw) && raw >= 0 && raw <= 50 ? raw : null;
}

/** While typing: "200000" → "200.000", "1234,5" → "1.234,5" (pt-BR digit grouping). */
export function groupDigits(raw: string): string {
  const clean = raw.replace(/[^\d,]/g, "");
  if (!clean) return "";
  const [int = "", ...rest] = clean.split(",");
  const grouped = int.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return rest.length ? `${grouped || "0"},${rest.join("").slice(0, 2)}` : grouped;
}

/** "200.000" / "1.234,56" / "2500" → number; empty or unreadable → null. */
export function parseBrNumber(raw: string): number | null {
  const t = raw.trim().replace(/\./g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
