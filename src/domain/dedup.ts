import { haversine } from "./geo";
import { normalizeText, textSimilarity } from "./text";

/** What deduplication looks at (one listing). */
export type DedupCandidate = {
  id: number;
  type: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  areaM2: number | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking: number | null;
  rentCents: number | null;
  /** Asking price when for sale (optional; compared like the rent). */
  salePriceCents?: number | null;
  lat: number | null;
  lng: number | null;
  /** True when the coordinates point at the address (not a neighbourhood centroid). */
  preciseLocation: boolean;
  title: string | null;
  description: string | null;
  features: string[];
};

export type DedupVerdict = "mesmo" | "possivel" | "diferente";
export type DedupMatch = { score: number; verdict: DedupVerdict; reasons: string[] };

/** Score ≥ SAME groups listings into one property; ≥ POSSIBLE links them as possible duplicates. */
export const SAME = 0.7;
export const POSSIBLE = 0.45;

const ABBR: Array<[RegExp, string]> = [
  [/\b(r|rua)\b/g, "rua"],
  [/\b(av|avenida)\b/g, "avenida"],
  [/\b(al|alameda)\b/g, "alameda"],
  [/\b(pc|pca|praca)\b/g, "praca"],
  [/\b(tv|trav|travessa)\b/g, "travessa"],
];

/** "R. Pernambuco, 1000" and "Rua Pernambuco" → "rua pernambuco". */
export function streetKey(street: string | null): string {
  let s = normalizeText(street).replace(/\b\d+\b.*$/, "").trim();
  for (const [re, to] of ABBR) s = s.replace(re, to);
  return s.replace(/\s+/g, " ").trim();
}

export function numberKey(number: string | null): string {
  return (/\d+/.exec(number ?? "") ?? [""])[0];
}

/** Bucket for blocking: listings are only compared within the same neighbourhood and bedrooms. */
export function blockKey(c: Pick<DedupCandidate, "neighborhood" | "bedrooms">): string {
  return `${normalizeText(c.neighborhood)}|${c.bedrooms ?? "?"}`;
}

function close(a: number | null, b: number | null, tolerance: number): boolean | null {
  if (a == null || b == null || a <= 0 || b <= 0) return null;
  return Math.abs(a - b) / Math.max(a, b) <= tolerance;
}

const COMPATIBLE: Record<string, string[]> = {
  apartamento: ["apartamento", "area_privativa", "duplex", "cobertura"],
  cobertura: ["cobertura", "apartamento", "duplex"],
  area_privativa: ["area_privativa", "apartamento"],
  duplex: ["duplex", "apartamento", "cobertura"],
  casa: ["casa", "casa_condominio"],
  casa_condominio: ["casa_condominio", "casa"],
  kitnet: ["kitnet", "loft", "apartamento"],
  loft: ["loft", "kitnet", "apartamento"],
};

/**
 * Probability-like score that two listings describe the same property. Hard differences
 * (bedrooms, area, type, far apart) rule it out; then address, coordinates, area, rent, rooms,
 * text and features add evidence. Similar listings are never assumed equal below SAME.
 */
export function compareListings(a: DedupCandidate, b: DedupCandidate): DedupMatch {
  const reasons: string[] = [];
  const no = (why: string): DedupMatch => ({ score: 0, verdict: "diferente", reasons: [why] });
  if (a.bedrooms != null && b.bedrooms != null && a.bedrooms !== b.bedrooms) return no("quartos diferentes");
  if (close(a.areaM2, b.areaM2, 0.15) === false) return no("áreas diferentes");
  if (a.type && b.type && !(COMPATIBLE[a.type] ?? [a.type]).includes(b.type)) return no("tipos diferentes");
  const distance = a.lat != null && a.lng != null && b.lat != null && b.lng != null ? haversine(a.lat, a.lng, b.lat, b.lng) : null;
  if (distance != null && a.preciseLocation && b.preciseLocation && distance > 400) return no("endereços distantes");
  const na = normalizeText(a.neighborhood);
  const nb = normalizeText(b.neighborhood);
  if (na && nb && na !== nb && (distance == null || distance > 400)) return no("bairros diferentes");
  const sa = numberKey(a.number);
  const sb = numberKey(b.number);
  if (sa && sb && sa !== sb && streetKey(a.street) === streetKey(b.street)) return no("números diferentes na mesma rua");

  let score = 0;
  const add = (points: number, why?: string) => {
    score += points;
    if (why) reasons.push(why);
  };
  const sameStreet = Boolean(streetKey(a.street)) && streetKey(a.street) === streetKey(b.street);
  if (sameStreet && sa && sa === sb) add(0.35, "mesmo endereço e número");
  else if (sameStreet) add(0.15, "mesma rua");
  if (distance != null && a.preciseLocation && b.preciseLocation) {
    if (distance <= 30) add(0.2, "mesmas coordenadas");
    else if (distance <= 100) add(0.1, "coordenadas próximas");
  }
  if (close(a.areaM2, b.areaM2, 0.03)) add(0.2, "mesma área");
  else if (close(a.areaM2, b.areaM2, 0.08)) add(0.1, "área parecida");
  if (close(a.rentCents, b.rentCents, 0.05)) add(0.1, "aluguel parecido");
  else if (close(a.rentCents, b.rentCents, 0.15)) add(0.05);
  if (close(a.salePriceCents ?? null, b.salePriceCents ?? null, 0.05)) add(0.1, "preço de venda parecido");
  else if (close(a.salePriceCents ?? null, b.salePriceCents ?? null, 0.15)) add(0.05);
  for (const [k, label] of [["suites", "suítes"], ["bathrooms", "banheiros"], ["parking", "vagas"]] as const) {
    if (a[k] != null && a[k] === b[k]) add(0.05, `mesmas ${label}`);
  }
  const sim = Math.max(textSimilarity(a.title, b.title), textSimilarity(a.description, b.description));
  if (sim >= 0.5) add(0.15, "textos muito parecidos");
  else if (sim >= 0.3) add(0.08);
  if (a.features.length && b.features.length) {
    const inter = a.features.filter((f) => b.features.includes(f)).length;
    if (inter / (a.features.length + b.features.length - inter) >= 0.7) add(0.05, "mesmas características");
  }
  score = Math.min(1, Math.round(score * 100) / 100);
  return { score, verdict: score >= SAME ? "mesmo" : score >= POSSIBLE ? "possivel" : "diferente", reasons };
}

/**
 * Groups candidates: union-find over "mesmo" pairs within each block; also returns the
 * "possivel" pairs (shown as possible duplicates, never merged).
 */
export function groupDuplicates(items: DedupCandidate[]): { groups: number[][]; possible: Array<[number, number, number]> } {
  const parent = new Map<number, number>(items.map((i) => [i.id, i.id]));
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const possible: Array<[number, number, number]> = [];
  const blocks = new Map<string, DedupCandidate[]>();
  for (const it of items) {
    const key = blockKey(it);
    blocks.set(key, [...(blocks.get(key) ?? []), it]);
  }
  for (const block of blocks.values()) {
    for (let i = 0; i < block.length; i++) {
      for (let j = i + 1; j < block.length; j++) {
        const m = compareListings(block[i], block[j]);
        if (m.verdict === "mesmo") parent.set(find(block[i].id), find(block[j].id));
        else if (m.verdict === "possivel") possible.push([block[i].id, block[j].id, m.score]);
      }
    }
  }
  const groups = new Map<number, number[]>();
  for (const it of items) groups.set(find(it.id), [...(groups.get(find(it.id)) ?? []), it.id]);
  return { groups: [...groups.values()].map((g) => g.sort((x, y) => x - y)), possible: possible.filter(([x, y]) => find(x) !== find(y)) };
}
