import { EMPTY_LISTING, withImpliedFeatures, type Feature, type Mode, type NormalizedListing, type PropertyType } from "./listing";
import { TYPE_LABEL } from "./listing";

/**
 * Demonstration data, only for showing the interface while no authorized source is connected.
 * Every listing says so in its title, has no link, and is flagged is_demo in the database.
 * Positions are real neighbourhood centres (OSM) with jitter; prices are invented.
 */
export const DEMO_PREFIX = "[DEMONSTRAÇÃO]";
export const DEMO_ADVERTISER = "Dados de demonstração (fictícios)";

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Invented rent level (R$/m²) per regional, only to make the demo look plausible. */
const RENT_M2: Record<string, number> = { "Centro-Sul": 52, Oeste: 38, Pampulha: 40, Leste: 33, Nordeste: 31, Noroeste: 32, Norte: 26, "Venda Nova": 25, Barreiro: 24 };

/** Invented sale level (R$/m²) per regional, only for the demo. */
const SALE_M2: Record<string, number> = { "Centro-Sul": 11_000, Oeste: 7_600, Pampulha: 8_200, Leste: 6_100, Nordeste: 5_600, Noroeste: 6_200, Norte: 4_600, "Venda Nova": 4_300, Barreiro: 4_100 };

const TYPES: Array<[PropertyType, number]> = [["apartamento", 0.55], ["casa", 0.12], ["cobertura", 0.06], ["area_privativa", 0.07], ["kitnet", 0.08], ["loft", 0.03], ["duplex", 0.04], ["casa_condominio", 0.05]];
const EXTRAS: Feature[] = ["varanda", "sacada", "elevador", "piscina", "academia", "portaria_24h", "mobiliado", "ar_condicionado", "aceita_animais", "closet", "churrasqueira", "lavanderia", "gas_canalizado", "agua_individual"];
const STREETS = ["Rua das Flores", "Rua do Ipê", "Rua Jacarandá", "Rua das Acácias", "Rua Paineira", "Rua do Cedro", "Rua das Palmeiras", "Rua Aroeira"];

export type DemoArea = { name: string; lat: number; lng: number; regional: string | null };

function pick<T>(r: () => number, weighted: Array<[T, number]>): T {
  let x = r();
  for (const [v, w] of weighted) {
    if ((x -= w) <= 0) return v;
  }
  return weighted[0][0];
}

/** `count` demo listings spread over the given neighbourhoods (stable for the same seed). */
export function demoListings(areas: DemoArea[], count: number, seed = 42): NormalizedListing[] {
  if (!areas.length) return [];
  const r = rng(seed);
  const out: NormalizedListing[] = [];
  for (let i = 0; i < count; i++) {
    const area = areas[Math.floor(r() * areas.length)];
    const type = pick(r, TYPES);
    const small = type === "kitnet" || type === "loft";
    const bedrooms = small ? (type === "loft" ? 1 : 0) : 1 + Math.floor(r() * (type === "casa" || type === "casa_condominio" ? 4 : 3.4));
    const area_m2 = Math.round((small ? 24 + r() * 26 : 35 + bedrooms * 22 + r() * 40) * (type === "cobertura" ? 1.6 : 1));
    const rentM2 = (RENT_M2[area.regional ?? ""] ?? 32) * (0.75 + r() * 0.5) * (type === "cobertura" ? 1.15 : 1);
    const rent = Math.round((area_m2 * rentM2) / 50) * 50;
    const hasCondo = !(type === "casa") && r() > 0.08;
    const condo = hasCondo ? Math.round((area_m2 * (6 + r() * 7)) / 10) * 10 : type === "casa" && r() > 0.5 ? 0 : null;
    const iptuKnown = r() > 0.2;
    const annual = r() > 0.4;
    const iptuMonth = Math.round(rent * (0.04 + r() * 0.06));
    const features = EXTRAS.filter(() => r() < 0.22);
    const lat = area.lat + (r() - 0.5) * 0.008;
    const lng = area.lng + (r() - 0.5) * 0.008;
    const exact = r() > 0.25;
    const owner = r() < 0.18;
    // About half the demo is for rent, 40% for sale and 10% both.
    const deal = r();
    const purposes: Mode[] = deal < 0.5 ? ["aluguel"] : deal < 0.9 ? ["compra"] : ["aluguel", "compra"];
    const saleM2 = (SALE_M2[area.regional ?? ""] ?? 6_000) * (0.75 + r() * 0.5) * (type === "cobertura" ? 1.2 : 1);
    const sale = Math.round((area_m2 * saleM2) / 5_000) * 5_000;
    out.push(
      withImpliedFeatures({
        ...EMPTY_LISTING,
        externalId: `demo-${seed}-${i}`,
        title: `${DEMO_PREFIX} ${TYPE_LABEL[type]}${bedrooms ? ` ${bedrooms} quarto${bedrooms > 1 ? "s" : ""}` : ""} ${purposes.length === 2 ? "para alugar ou comprar" : purposes[0] === "compra" ? "à venda" : "para alugar"} no ${area.name}`,
        purposes,
        salePriceCents: purposes.includes("compra") ? sale * 100 : null,
        description: "Anúncio fictício gerado para demonstrar a interface. Não corresponde a um imóvel real.",
        type,
        rentCents: purposes.includes("aluguel") ? rent * 100 : null,
        condoCents: condo == null ? null : condo * 100,
        iptuCents: iptuKnown ? (annual ? iptuMonth * 12 : iptuMonth) * 100 : null,
        iptuPeriod: iptuKnown ? (annual ? "anual" : "mensal") : null,
        areaM2: area_m2,
        bedrooms,
        suites: bedrooms >= 2 && r() > 0.45 ? 1 : 0,
        bathrooms: Math.max(1, Math.round(bedrooms * 0.8 + r())),
        parking: small ? (r() > 0.7 ? 1 : 0) : Math.floor(r() * 3),
        features,
        advertiserType: owner ? "proprietario" : "imobiliaria",
        advertiserName: DEMO_ADVERTISER,
        street: exact ? STREETS[Math.floor(r() * STREETS.length)] : null,
        number: exact ? String(10 + Math.floor(r() * 990)) : null,
        neighborhood: area.name,
        city: "Belo Horizonte",
        lat: Math.round(lat * 1e5) / 1e5,
        lng: Math.round(lng * 1e5) / 1e5,
        addressHidden: !exact,
      }),
    );
  }
  return out;
}

/** The same home "announced" by a second demo source (to show deduplication), slightly different. */
export function demoDuplicate(l: NormalizedListing, rentDelta: number): NormalizedListing {
  return { ...l, externalId: `${l.externalId}-b`, rentCents: l.rentCents == null ? null : l.rentCents + rentDelta, salePriceCents: l.salePriceCents == null ? null : l.salePriceCents + rentDelta * 100, title: l.title ? `${l.title} (outro anúncio)` : null, features: l.features.slice(0, -1) };
}
