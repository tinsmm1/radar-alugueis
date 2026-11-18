import { z } from "zod";
import { normalizeText, scrubContacts } from "./text";

export const PROPERTY_TYPES = ["apartamento", "casa", "cobertura", "area_privativa", "loft", "kitnet", "duplex", "casa_condominio"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const TYPE_LABEL: Record<PropertyType, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  cobertura: "Cobertura",
  area_privativa: "Área privativa",
  loft: "Loft",
  kitnet: "Kitnet/studio",
  duplex: "Duplex",
  casa_condominio: "Casa em condomínio",
};

/** The 18 special features of the product, in display order. */
export const FEATURES = [
  "carregador_eletrico", "preparo_carregador", "cobertura", "area_privativa", "varanda", "sacada", "elevador", "piscina", "academia", "portaria_24h", "condominio_fechado",
  "mobiliado", "ar_condicionado", "aceita_animais", "suite", "closet", "churrasqueira", "lavanderia", "gas_canalizado", "agua_individual",
] as const;
export type Feature = (typeof FEATURES)[number];

export const FEATURE_LABEL: Record<Feature, string> = {
  carregador_eletrico: "Carregador de carro elétrico",
  preparo_carregador: "Preparado para carregador elétrico",
  cobertura: "Cobertura",
  area_privativa: "Área privativa",
  varanda: "Varanda",
  sacada: "Sacada",
  elevador: "Elevador",
  piscina: "Piscina",
  academia: "Academia",
  portaria_24h: "Portaria 24 h",
  condominio_fechado: "Condomínio fechado",
  mobiliado: "Mobiliado",
  ar_condicionado: "Ar-condicionado",
  aceita_animais: "Aceita animais",
  suite: "Suíte",
  closet: "Closet",
  churrasqueira: "Churrasqueira",
  lavanderia: "Lavanderia",
  gas_canalizado: "Gás canalizado",
  agua_individual: "Água individualizada",
};

/**
 * Words that reveal a feature, in Portuguese listings and in VRSync feature tags (English).
 * Matched on normalized text with word boundaries; negations are handled in detectFeatures.
 */
const FEATURE_PATTERNS: Record<Feature, RegExp> = {
  // EV charging (owner priority): an installed charger or a stated infrastructure for one.
  carregador_eletrico:
    /\b(carregadore?s? (de |para )?(carros?|veiculos?) eletricos?|carregadore?s? eletricos?|carregadore?s? veicular(es)?|wall ?box|pontos? de recarga|estac(ao|oes) de recarga|recarga (de |para )?(carros?|veiculos?) eletricos?|tomada (de |para )?(carros?|veiculos?) eletricos?|electric (car|vehicle) charg\w*|ev charg\w*|charging station|car charger)\b/,
  preparo_carregador:
    /\b(preparad[oa]s? para (carregador|carros? eletricos?|veiculos? eletricos?|recarga)|infra ?estrutura (para|de) (carregador|carros? eletricos?|veiculos? eletricos?|recarga)|previsao (para|de) carregador|tubulacao (para|de) carregador|ponto (para|de) carregador|possibilidade de (instalar|instalacao de) carregador|pronto para (carros?|veiculos?) eletricos?)\b/,
  cobertura: /\b(cobertura|penthouse)\b/,
  area_privativa: /\b(area privativa|private area|garden)\b/,
  varanda: /\b(varanda|balcony|varanda gourmet)\b/,
  sacada: /\b(sacada)\b/,
  elevador: /\b(elevador|elevator|elevadores)\b/,
  piscina: /\b(piscina|pool)\b/,
  academia: /\b(academia|fitness|gym|sala de ginastica)\b/,
  portaria_24h: /\b(portaria 24|porteiro 24|portaria 24 horas|24 hour security|doorman|concierge)\b/,
  condominio_fechado: /\b(condominio fechado|gated community|closed condominium)\b/,
  mobiliado: /\b(mobiliado|mobiliada|furnished|semi mobiliado)\b/,
  ar_condicionado: /\b(ar condicionado|ar condicionados|air conditioning|split)\b/,
  aceita_animais: /\b(aceita animais|aceita pet|aceita pets|pet friendly|pets allowed)\b/,
  suite: /\b(suite|suites)\b/,
  closet: /\b(closet|walk in closet)\b/,
  churrasqueira: /\b(churrasqueira|bbq|barbecue|espaco gourmet)\b/,
  lavanderia: /\b(lavanderia|area de servico|laundry)\b/,
  gas_canalizado: /\b(gas canalizado|gas encanado|piped gas)\b/,
  agua_individual: /\b(agua individual|agua individualizada|hidrometro individual|individual water)\b/,
};

const NEGATION = /\b(nao|sem|proibido|nao aceita)\s+(\w+\s+){0,2}$/;

/** Features found in free text and tags. "Não aceita animais" and "sem elevador" are not matches. */
export function detectFeatures(...texts: Array<string | null | undefined>): Feature[] {
  const found = new Set<Feature>();
  for (const raw of texts) {
    const text = normalizeText(raw);
    if (!text) continue;
    for (const f of FEATURES) {
      const re = new RegExp(FEATURE_PATTERNS[f].source, "g");
      for (let m = re.exec(text); m; m = re.exec(text)) {
        if (!NEGATION.test(text.slice(Math.max(0, m.index - 30), m.index))) {
          found.add(f);
          break;
        }
      }
    }
  }
  return FEATURES.filter((f) => found.has(f));
}

/** Free-text or VRSync type → product type; unknown or non-residential → null. */
export function normalizeType(...hints: Array<string | null | undefined>): PropertyType | null {
  const t = normalizeText(hints.filter(Boolean).join(" "));
  if (!t) return null;
  if (/\b(cobertura|penthouse)\b/.test(t)) return "cobertura";
  if (/\b(casa em condominio|condo house|sobrado em condominio|casa de condominio)\b/.test(t)) return "casa_condominio";
  if (/\b(area privativa|garden)\b/.test(t)) return "area_privativa";
  if (/\b(kitnet|kitinete|studio|estudio|conjugado|flat)\b/.test(t)) return "kitnet";
  if (/\b(loft)\b/.test(t)) return "loft";
  if (/\b(duplex|triplex)\b/.test(t)) return "duplex";
  if (/\b(apartamento|apartment|apto)\b/.test(t)) return "apartamento";
  if (/\b(casa|home|house|sobrado|residencia)\b/.test(t)) return "casa";
  return null;
}

export type AdvertiserType = "imobiliaria" | "proprietario";

/** The two products of the hub: renting and buying. A listing may offer both. */
export const MODES = ["aluguel", "compra"] as const;
export type Mode = (typeof MODES)[number];
export const MODE_LABEL: Record<Mode, string> = { aluguel: "Alugar", compra: "Comprar" };
export type IptuPeriod = "mensal" | "anual";

/** One listing after normalization; every unknown stays null (never 0). */
/** Only http(s) links (z.url() alone accepts javascript: and data:). */
export const httpUrl = z.url().max(2000).refine((u) => /^https?:\/\//i.test(u), "Use um link http(s).");

export const normalizedListingSchema = z.object({
  externalId: z.string().min(1).max(200),
  url: httpUrl.nullable(),
  title: z.string().max(300).nullable(),
  description: z.string().max(20_000).nullable(),
  type: z.enum(PROPERTY_TYPES).nullable(),
  /** Which deals the listing offers (at least one). */
  purposes: z.array(z.enum(MODES)).min(1).max(2),
  rentCents: z.int().min(1).max(100_000_000).nullable(),
  /** Asking price for a sale (cents). */
  salePriceCents: z.int().min(1_000_000).max(100_000_000_000).nullable(),
  condoCents: z.int().min(0).max(50_000_000).nullable(),
  iptuCents: z.int().min(0).max(100_000_000).nullable(),
  iptuPeriod: z.enum(["mensal", "anual"]).nullable(),
  otherFeesCents: z.int().min(0).max(50_000_000).nullable(),
  feesNote: z.string().max(300).nullable(),
  areaM2: z.number().positive().max(100_000).nullable(),
  bedrooms: z.int().min(0).max(50).nullable(),
  suites: z.int().min(0).max(50).nullable(),
  bathrooms: z.int().min(0).max(50).nullable(),
  parking: z.int().min(0).max(50).nullable(),
  features: z.array(z.enum(FEATURES)),
  advertiserType: z.enum(["imobiliaria", "proprietario"]).nullable(),
  advertiserName: z.string().max(200).nullable(),
  photos: z.array(httpUrl).max(40),
  street: z.string().max(200).nullable(),
  number: z.string().max(20).nullable(),
  neighborhood: z.string().max(120).nullable(),
  city: z.string().max(120).nullable(),
  postalCode: z.string().max(12).nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  /** The source hides the exact address (VRSync displayAddress != All). */
  addressHidden: z.boolean(),
});
export type NormalizedListing = z.infer<typeof normalizedListingSchema>;

export const EMPTY_LISTING: Omit<NormalizedListing, "externalId"> = {
  purposes: ["aluguel"], salePriceCents: null,
  url: null, title: null, description: null, type: null, rentCents: null, condoCents: null, iptuCents: null, iptuPeriod: null,
  otherFeesCents: null, feesNote: null, areaM2: null, bedrooms: null, suites: null, bathrooms: null, parking: null, features: [],
  advertiserType: null, advertiserName: null, photos: [], street: null, number: null, neighborhood: null, city: null, postalCode: null,
  lat: null, lng: null, addressHidden: false,
};

/** Only Belo Horizonte is in scope (the product's city); a missing city is accepted. */
export function inScope(l: Pick<NormalizedListing, "city">): boolean {
  return !l.city || normalizeText(l.city) === "belo horizonte";
}

/** Fills features implied by fields (suite count, cobertura type), dedupes, and strips contact data from text. */
export function withImpliedFeatures(l: NormalizedListing): NormalizedListing {
  const set = new Set<Feature>(l.features);
  if ((l.suites ?? 0) > 0) set.add("suite");
  if (l.type === "cobertura") set.add("cobertura");
  if (l.type === "area_privativa") set.add("area_privativa");
  if (l.type === "casa_condominio") set.add("condominio_fechado");
  return { ...l, title: l.title && scrubContacts(l.title), description: l.description && scrubContacts(l.description), features: FEATURES.filter((f) => set.has(f)) };
}
