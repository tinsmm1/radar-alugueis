import { detectFeatures, EMPTY_LISTING, inScope, normalizeType, normalizedListingSchema, withImpliedFeatures, type Mode, type NormalizedListing } from "./listing";
import { parseArea, parseCount, parseMoney } from "./money";
import { titleCase } from "./text";

/**
 * Apify datasets: the items produced by scrapers of ZAP, Viva Real, OLX, QuintoAndar, Imovelweb, Loft…
 * Every actor uses its own field names, so this mapper is tolerant: it reads both the "glue API"
 * shape used by ZAP/Viva Real (listing.pricingInfos, address.point, usableAreas[]) and flat shapes
 * (price, rent, area, neighborhood, latitude…). Contact fields (phones, e-mails) are never read.
 */
export type ApifyResult = { listings: NormalizedListing[]; raws: Record<string, unknown>; skipped: Record<string, number> };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** First non-empty value among dotted paths ("listing.address.neighborhood"); arrays give their first element. */
function pick(item: Obj, ...paths: string[]): unknown {
  for (const path of paths) {
    let cur: unknown = item;
    for (const key of path.split(".")) {
      if (Array.isArray(cur)) cur = cur[0];
      cur = isObj(cur) ? cur[key] : undefined;
    }
    if (Array.isArray(cur)) cur = cur.length ? cur[0] : undefined;
    if (cur != null && cur !== "") return cur;
  }
  return undefined;
}

function str(v: unknown, max = 300): string | null {
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Shared prefixes where actors nest the listing body. */
const ROOTS = ["", "listing.", "data.", "property.", "imovel."];
function p(item: Obj, ...keys: string[]): unknown {
  return pick(item, ...ROOTS.flatMap((r) => keys.map((k) => r + k)));
}

type Pricing = { businessType?: unknown; price?: unknown; monthlyCondoFee?: unknown; yearlyIptu?: unknown; rentalInfo?: unknown };

function pricingInfos(item: Obj): Pricing[] {
  const list = pick(item, "listing.pricingInfos") ?? undefined;
  const raw = (isObj(item.listing) && Array.isArray(item.listing.pricingInfos) ? item.listing.pricingInfos : Array.isArray(item.pricingInfos) ? item.pricingInfos : list ? [list] : []) as unknown[];
  return raw.filter(isObj) as Pricing[];
}

function photoUrls(item: Obj): string[] {
  const out: string[] = [];
  const lists = [item.medias, item.images, item.photos, item.imagens, item.fotos, isObj(item.listing) ? item.listing.medias : undefined, isObj(item.listing) ? item.listing.images : undefined];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      const u = typeof m === "string" ? m : isObj(m) ? str(m.url ?? m.src ?? m.original ?? m.href, 2000) : null;
      if (!u) continue;
      // ZAP/Viva Real image templates: ".../{action}/{width}x{height}/..."
      const fixed = u.replace("{action}", "crop").replace("{width}", "870").replace("{height}", "653");
      if (/^https?:\/\//i.test(fixed)) out.push(fixed);
    }
  }
  return [...new Set(out)].slice(0, 40);
}

function linkOf(item: Obj): string | null {
  const href = str(pick(item, "url", "link.href", "link", "href", "detailUrl", "listingUrl", "listing.link.href"), 2000);
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  return null;
}

/** "RENTAL" / "SALE" / "aluguel" / "venda" / "For Rent"… → mode. */
function modeOf(v: unknown): Mode | null {
  const t = String(v ?? "").toLowerCase();
  if (/rent|alug|loca/.test(t)) return "aluguel";
  if (/sale|sell|vend|compra|buy/.test(t)) return "compra";
  return null;
}

export function mapApifyItem(item: Obj, fallbackMode: Mode | null): NormalizedListing | { skip: string } {
  const externalId = str(p(item, "id", "listingId", "externalId", "code", "codigo", "legacyId", "listId"), 200) ?? linkOf(item);
  if (!externalId) return { skip: "sem identificador" };

  let rentCents: number | null = null;
  let salePriceCents: number | null = null;
  let condoCents: number | null = null;
  let iptuCents: number | null = null;
  let iptuPeriod: "mensal" | "anual" | null = null;

  for (const pi of pricingInfos(item)) {
    const mode = modeOf(pi.businessType);
    const price = parseMoney(pi.price ?? (isObj(pi.rentalInfo) ? pi.rentalInfo.monthlyRentalTotalPrice : undefined));
    if (mode === "aluguel" && price) rentCents = price;
    if (mode === "compra" && price) salePriceCents = price;
    condoCents ??= parseMoney(pi.monthlyCondoFee);
    if (iptuCents == null && pi.yearlyIptu != null) {
      iptuCents = parseMoney(pi.yearlyIptu);
      if (iptuCents != null) iptuPeriod = "anual";
    }
  }

  if (rentCents == null) rentCents = parseMoney(p(item, "rent", "rentPrice", "rentalPrice", "aluguel", "valorAluguel", "monthlyRent"));
  if (salePriceCents == null) salePriceCents = parseMoney(p(item, "salePrice", "sellPrice", "precoVenda", "valorVenda"));
  const genericPrice = parseMoney(p(item, "price", "preco", "valor", "priceValue", "price.value", "price.amount"));
  if (genericPrice != null && rentCents == null && salePriceCents == null) {
    const mode = modeOf(p(item, "businessType", "transactionType", "operationType", "purpose", "finalidade", "negocio", "type")) ?? fallbackMode;
    // Without a stated deal, a price under R$ 30 mil is a rent, above it a sale.
    if (mode === "aluguel" || (mode == null && genericPrice < 3_000_000)) rentCents = genericPrice;
    else salePriceCents = genericPrice;
  }
  condoCents ??= parseMoney(p(item, "condoFee", "condominium", "condominio", "valorCondominio", "monthlyCondoFee"));
  if (iptuCents == null) {
    const yearly = parseMoney(p(item, "yearlyIptu", "iptuAnual"));
    const monthly = parseMoney(p(item, "iptu", "iptuMensal", "monthlyIptu"));
    if (yearly != null) [iptuCents, iptuPeriod] = [yearly, "anual"];
    else if (monthly != null) [iptuCents, iptuPeriod] = [monthly, "mensal"];
  }
  if (salePriceCents != null && salePriceCents < 1_000_000) salePriceCents = null;

  const purposes: Mode[] = [];
  if (rentCents) purposes.push("aluguel");
  if (salePriceCents) purposes.push("compra");
  if (!purposes.length) return { skip: "sem preço" };

  const title = str(p(item, "title", "titulo", "name"));
  const description = str(p(item, "description", "descricao", "desc"), 20_000);
  const typeHint = str(p(item, "unitTypes", "propertyType", "type", "tipo", "unitType", "category"));
  const amenities = p(item, "amenities", "features", "caracteristicas");
  const amenityText = Array.isArray(amenities) ? amenities.map(String).join(" ").replace(/_/g, " ") : str(amenities, 2000);
  const allAmenities = [isObj(item.listing) ? item.listing.amenities : undefined, item.amenities, item.features].flatMap((a) => (Array.isArray(a) ? a.map(String) : [])).join(" ").replace(/_/g, " ");

  const lat = num(p(item, "address.point.lat", "address.geoLocation.location.lat", "location.lat", "latitude", "lat", "geo.lat", "coordinates.lat"));
  const lng = num(p(item, "address.point.lon", "address.point.lng", "address.geoLocation.location.lon", "location.lng", "location.lon", "longitude", "lng", "lon", "geo.lng", "coordinates.lng"));
  const city = str(p(item, "address.city", "city", "cidade", "location.city"), 120);
  const neighborhood = str(p(item, "address.neighborhood", "neighborhood", "bairro", "location.neighborhood", "address.district", "district"), 120);
  const advertiserName = str(pick(item, "account.name", "advertiser.name", "publisher.name", "realEstate.name", "imobiliaria", "agency.name", "listing.advertiserName"), 200);

  const candidate: NormalizedListing = {
    ...EMPTY_LISTING,
    externalId,
    url: linkOf(item),
    title,
    description,
    type: normalizeType(title, typeHint?.replace(/_/g, " "), typeHint === "APARTMENT" ? "apartamento" : typeHint === "HOME" ? "casa" : typeHint === "PENTHOUSE" ? "cobertura" : null) ?? "apartamento",
    purposes,
    rentCents,
    salePriceCents,
    condoCents,
    iptuCents,
    iptuPeriod,
    areaM2: parseArea(p(item, "usableAreas", "usableArea", "area", "areaUtil", "totalAreas", "totalArea", "size", "metragem")),
    bedrooms: parseCount(p(item, "bedrooms", "quartos", "rooms", "dormitorios")),
    suites: parseCount(p(item, "suites", "suítes")),
    bathrooms: parseCount(p(item, "bathrooms", "banheiros")),
    parking: parseCount(p(item, "parkingSpaces", "parking", "vagas", "garage", "garages")),
    features: detectFeatures(title, description, amenityText, allAmenities),
    advertiserType: advertiserName ? "imobiliaria" : null,
    advertiserName,
    photos: photoUrls(item),
    street: str(p(item, "address.street", "street", "rua", "logradouro"), 200),
    number: str(p(item, "address.streetNumber", "streetNumber", "numero"), 20),
    neighborhood: neighborhood && titleCase(neighborhood),
    city: city && titleCase(city),
    postalCode: str(p(item, "address.zipCode", "zipCode", "cep", "postalCode"), 12),
    lat: lat != null && lat >= -90 && lat <= 90 && lat !== 0 ? lat : null,
    lng: lng != null && lng >= -180 && lng <= 180 && lng !== 0 ? lng : null,
  };
  if (!inScope(candidate)) return { skip: "fora de Belo Horizonte" };
  const valid = normalizedListingSchema.safeParse(withImpliedFeatures(candidate));
  if (!valid.success) return { skip: "dados inválidos" };
  return valid.data;
}

/** Contact data is dropped from the stored payload (LGPD). */
const CONTACT_KEYS = /phone|telefone|whatsapp|email|e-mail|contact|celular/i;
function scrub(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(scrub);
  if (isObj(v)) return Object.fromEntries(Object.entries(v).filter(([k]) => !CONTACT_KEYS.test(k)).map(([k, x]) => [k, scrub(x)]));
  return v;
}

export function parseApifyItems(items: unknown, fallbackMode: Mode | null = null): ApifyResult {
  const listings: NormalizedListing[] = [];
  const raws: Record<string, unknown> = {};
  const skipped: Record<string, number> = {};
  const seen = new Set<string>();
  for (const raw of Array.isArray(items) ? items : []) {
    if (!isObj(raw)) continue;
    const res = mapApifyItem(raw, fallbackMode);
    if ("skip" in res) {
      skipped[res.skip] = (skipped[res.skip] ?? 0) + 1;
      continue;
    }
    if (seen.has(res.externalId)) continue;
    seen.add(res.externalId);
    listings.push(res);
    raws[res.externalId] = scrub(raw);
  }
  return { listings, raws, skipped };
}

/** "usuario~minha-tarefa", "https://console.apify.com/…/tasks/abc123" or "https://api.apify.com/v2/actor-tasks/abc123/…" → task id. */
export function apifyTaskId(input: string): string | null {
  const s = input.trim();
  const fromUrl = /(?:actor-tasks|tasks)\/([\w~.-]+)/.exec(s);
  const id = fromUrl ? fromUrl[1] : s;
  return /^[\w~][\w~.-]{2,119}$/.test(id) && !id.includes("..") ? id : null;
}
