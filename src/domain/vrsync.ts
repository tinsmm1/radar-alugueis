import { XMLParser } from "fast-xml-parser";
import { detectFeatures, EMPTY_LISTING, inScope, normalizeType, normalizedListingSchema, withImpliedFeatures, type NormalizedListing, type PropertyType } from "./listing";
import { parseArea, parseCount, parseMoney } from "./money";
import { scrubContacts, titleCase } from "./text";

/**
 * VRSync: the XML feed format real-estate agencies publish for Brazilian portals
 * (ListingDataFeed > Listings > Listing). Rentals and sales ("For Rent", "For Sale", "Sale/Rent") in
 * Belo Horizonte are kept. Contact fields are never read: only the agency name.
 */
export type FeedResult =
  | { ok: true; provider: string | null; listings: NormalizedListing[]; raws: Record<string, unknown>; skipped: Record<string, number> }
  | { ok: false; error: string };

/** The original listing node without personal contact data (LGPD): only the agency name stays. */
export function scrubRaw(item: Record<string, unknown>): Record<string, unknown> {
  const { ContactInfo, ...rest } = item;
  const name = ContactInfo && typeof ContactInfo === "object" ? (ContactInfo as Record<string, unknown>).Name : undefined;
  const clean = deepScrub(rest) as Record<string, unknown>;
  return name ? { ...clean, ContactInfo: { Name: name } } : clean;
}

/** Contact data written inside free text (descriptions, titles) is removed from every string. */
function deepScrub(v: unknown): unknown {
  if (typeof v === "string") return scrubContacts(v);
  if (Array.isArray(v)) return v.map(deepScrub);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepScrub(x)]));
  return v;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
  isArray: (name) => ["Listing", "Item", "Feature"].includes(name),
});

type Node = Record<string, unknown> | string | undefined;

function text(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === "string" || typeof node === "number") return String(node).trim() || null;
  if (typeof node === "object" && "#text" in (node as object)) return text((node as Record<string, unknown>)["#text"]);
  return null;
}

function attr(node: unknown, name: string): string | null {
  return node && typeof node === "object" ? (text((node as Record<string, unknown>)[`@${name}`]) ?? null) : null;
}

const VR_TYPES: Record<string, PropertyType> = {
  apartment: "apartamento",
  home: "casa",
  sobrado: "casa",
  "village house": "casa_condominio",
  condo: "casa_condominio",
  penthouse: "cobertura",
  flat: "kitnet",
  kitnet: "kitnet",
  studio: "kitnet",
  loft: "loft",
};

function vrType(raw: string | null, title: string | null): PropertyType | null {
  // "Residential / Apartment" → "apartment"; title words refine (duplex, área privativa).
  const key = (raw ?? "").split("/").pop()?.trim().toLowerCase() ?? "";
  const fromTitle = normalizeType(title);
  if (fromTitle && fromTitle !== "apartamento" && fromTitle !== "casa") return fromTitle;
  return VR_TYPES[key] ?? fromTitle ?? normalizeType(raw);
}

function iptuPeriod(node: unknown): "mensal" | "anual" | null {
  const p = (attr(node, "period") ?? "").toLowerCase();
  if (p.startsWith("year") || p === "annual") return "anual";
  if (p.startsWith("month")) return "mensal";
  return null;
}

export function parseVrsync(xml: string): FeedResult {
  if (!/<ListingDataFeed[\s>]/i.test(xml.slice(0, 5000))) return { ok: false, error: "O arquivo não é um feed VRSync (falta <ListingDataFeed>)." };
  // Custom DTD entities are never needed in a feed; refusing them avoids entity-expansion tricks.
  if (/<!ENTITY/i.test(xml)) return { ok: false, error: "O feed declara entidades XML (<!ENTITY>), o que não é aceito." };
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "XML inválido." };
  }
  const feed = doc.ListingDataFeed as Record<string, Node> | undefined;
  const items = ((feed?.Listings as Record<string, unknown> | undefined)?.Listing as Array<Record<string, Node>> | undefined) ?? [];
  const provider = text((feed?.Header as Record<string, unknown> | undefined)?.Provider);
  const skipped: Record<string, number> = {};
  const skip = (why: string) => (skipped[why] = (skipped[why] ?? 0) + 1);
  const seen = new Map<string, NormalizedListing>();
  const raws: Record<string, unknown> = {};

  for (const item of items) {
    const id = text(item.ListingID);
    if (!id) {
      skip("sem ListingID");
      continue;
    }
    const transaction = (text(item.TransactionType) ?? "").toLowerCase();
    const forRent = transaction.includes("rent");
    const forSale = transaction.includes("sale");
    if (!forRent && !forSale) {
      skip("sem tipo de negócio");
      continue;
    }
    const d = (item.Details ?? {}) as Record<string, unknown>;
    const loc = (item.Location ?? {}) as Record<string, unknown>;
    const title = text(item.Title);
    const description = text(d.Description);
    const tags = (((d.Features as Record<string, unknown> | undefined)?.Feature as unknown[]) ?? []).map(text).filter(Boolean).join(" · ");
    const media = (((item.Media as Record<string, unknown> | undefined)?.Item as unknown[]) ?? []).filter((m) => (attr(m, "medium") ?? "image") === "image");
    media.sort((a, b) => Number(attr(b, "primary") === "true") - Number(attr(a, "primary") === "true"));
    const display = (attr(item.Location, "displayAddress") ?? "All").toLowerCase();
    const lat = Number(text(loc.Latitude));
    const lng = Number(text(loc.Longitude));
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    const draft: NormalizedListing = {
      ...EMPTY_LISTING,
      externalId: id.slice(0, 200),
      url: safeUrl(text(item.DetailViewUrl)),
      title: title?.slice(0, 300) ?? null,
      description: description?.slice(0, 20_000) ?? null,
      type: vrType(text(d.PropertyType), title),
      purposes: [...(forRent ? (["aluguel"] as const) : []), ...(forSale ? (["compra"] as const) : [])],
      rentCents: forRent ? parseMoney(text(d.RentalPrice) ?? (!forSale ? text(d.ListPrice) : null)) || null : null,
      salePriceCents: forSale ? parseMoney(text(d.ListPrice)) || null : null,
      condoCents: parseMoney(text(d.PropertyAdministrationFee)),
      iptuCents: parseMoney(text(d.Iptu) ?? text(d.YearlyTax)),
      iptuPeriod: d.YearlyTax != null && d.Iptu == null ? "anual" : iptuPeriod(d.Iptu),
      areaM2: parseArea(text(d.LivingArea) ?? text(d.UsableArea)),
      bedrooms: parseCount(text(d.Bedrooms)),
      suites: parseCount(text(d.Suites)),
      bathrooms: parseCount(text(d.Bathrooms)),
      parking: parseCount(text(d.Garage)),
      features: detectFeatures(title, description, tags),
      advertiserType: "imobiliaria",
      advertiserName: text((item.ContactInfo as Record<string, unknown> | undefined)?.Name)?.slice(0, 200) ?? provider,
      photos: media.map((m) => safeUrl(text(m))).filter((u): u is string => Boolean(u)).slice(0, 40),
      street: display === "neighborhood" ? null : (text(loc.Address)?.slice(0, 200) ?? null),
      number: display === "all" ? (text(loc.StreetNumber)?.slice(0, 20) ?? null) : null,
      neighborhood: text(loc.Neighborhood) ? titleCase(text(loc.Neighborhood)!).slice(0, 120) : null,
      city: text(loc.City) ? titleCase(text(loc.City)!) : null,
      postalCode: text(loc.PostalCode)?.replace(/\D/g, "").slice(0, 8) || null,
      lat: hasCoords ? lat : null,
      lng: hasCoords ? lng : null,
      addressHidden: display !== "all",
    };
    // A deal without its price is useless for that mode; keep the listing only for the priced ones.
    draft.purposes = draft.purposes.filter((m) => (m === "aluguel" ? draft.rentCents : draft.salePriceCents));
    if (!draft.purposes.length) {
      skip("sem preço");
      continue;
    }
    if (!inScope(draft)) {
      skip("fora de Belo Horizonte");
      continue;
    }
    const valid = normalizedListingSchema.safeParse(withImpliedFeatures(draft));
    if (!valid.success) {
      skip("dados inválidos");
      continue;
    }
    seen.set(valid.data.externalId, valid.data);
    raws[valid.data.externalId] = scrubRaw(item as Record<string, unknown>);
  }
  return { ok: true, provider, listings: [...seen.values()], raws, skipped };
}

/** Only http(s) links are kept (no javascript:, data: or relative paths). */
export function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
}
