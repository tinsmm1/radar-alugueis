import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { favorites, listings, possibleDuplicates, priceHistory, properties, sources } from "@/db/schema";
import { costPerM2, monthlyCost } from "@/domain/cost";
import { groupDuplicates, type DedupCandidate } from "@/domain/dedup";
import { dropBp } from "@/domain/lifecycle";
import { pricePerM2 } from "@/domain/purchase";
import type { IptuPeriod } from "@/domain/listing";
import { normalizeText } from "@/domain/text";

const STATUS_RANK: Record<string, number> = { ativo: 0, possivelmente_indisponivel: 1, indisponivel: 2 };

/** SQL twin of normalizeText() for the listing neighbourhood. */
const NORMALIZED_NEIGHBORHOOD = sql`trim(regexp_replace(lower(unaccent(coalesce(${listings.neighborhood}, ''))), '[^a-z0-9]+', ' ', 'g'))`;

/**
 * Regroups the blocks (neighbourhood + bedrooms) of the touched listings into properties:
 * "mesmo" pairs share a property, "possível" pairs are recorded but not merged. Favourites of
 * merged properties (and price watches) move to the surviving one. Returns the refreshed
 * properties and those that started being offered in a mode (for "novo" notifications).
 */
export async function regroup(touched: number[]): Promise<{ ids: number[]; opened: Opened[] }> {
  if (!touched.length) return { ids: [], opened: [] };
  const db = getDb();
  const seeds = await db.select({ neighborhood: listings.neighborhood, bedrooms: listings.bedrooms, propertyId: listings.propertyId }).from(listings).where(inArray(listings.id, touched));
  const blocks = new Set(seeds.map((s) => `${normalizeText(s.neighborhood)}|${s.bedrooms ?? "?"}`));
  // Properties of touched listings always refresh (an unavailable listing leaves the grouping
  // below but its property's status must follow).
  const dirty = new Set<number>(seeds.map((s) => s.propertyId).filter((x): x is number => x != null));
  for (const block of blocks) {
    const [nb, bd] = block.split("|");
    const rows = await db
      .select()
      .from(listings)
      .where(and(sql`${NORMALIZED_NEIGHBORHOOD} = ${nb}`, bd === "?" ? isNull(listings.bedrooms) : eq(listings.bedrooms, Number(bd))));
    const live = rows.filter((r) => r.status !== "indisponivel" || r.propertyId == null);
    const candidates: DedupCandidate[] = live.map((r) => ({
      id: r.id, type: r.type, street: r.street, number: r.number, neighborhood: r.neighborhood, areaM2: r.areaM2, bedrooms: r.bedrooms, suites: r.suites,
      bathrooms: r.bathrooms, parking: r.parking, rentCents: r.rentCents, salePriceCents: r.salePriceCents, lat: r.lat, lng: r.lng, preciseLocation: r.lat != null && !r.addressHidden,
      title: r.title, description: r.description, features: r.features,
    }));
    const { groups, possible } = groupDuplicates(candidates);
    const current = new Map(live.map((r) => [r.id, r.propertyId]));
    const claimed = new Set<number>();
    for (const group of groups) {
      const owned = [...new Set(group.map((id) => current.get(id)).filter((x): x is number => x != null))].sort((a, b) => a - b);
      let target = owned.find((p) => !claimed.has(p));
      if (target == null) {
        const [p] = await db.insert(properties).values({}).returning({ id: properties.id });
        target = p.id;
      }
      claimed.add(target);
      dirty.add(target);
      const moving = group.filter((id) => current.get(id) !== target);
      if (moving.length) await db.update(listings).set({ propertyId: target }).where(inArray(listings.id, moving));
      for (const old of owned.filter((p) => p !== target)) {
        dirty.add(old);
        await db.execute(sql`insert into favorites (list_id, property_id, note, created_at) select list_id, ${target}, note, created_at from favorites where property_id = ${old} on conflict do nothing`);
        await db.execute(sql`insert into price_watches (property_id, mode, target_cents, start_price_cents, notified_price_cents, notified_at, created_at) select ${target}, mode, target_cents, start_price_cents, notified_price_cents, notified_at, created_at from price_watches where property_id = ${old} on conflict do nothing`);
        // The merged-away property keeps nothing that would hold it alive as a ghost.
        const emptied = sql`not exists (select 1 from listings l where l.property_id = ${old})`;
        await db.execute(sql`delete from favorites where property_id = ${old} and ${emptied}`);
        await db.execute(sql`delete from price_watches where property_id = ${old} and ${emptied}`);
      }
    }
    const ids = live.map((r) => r.id);
    if (ids.length) await db.delete(possibleDuplicates).where(or(inArray(possibleDuplicates.a, ids), inArray(possibleDuplicates.b, ids)));
    if (possible.length) await db.insert(possibleDuplicates).values(possible.map(([a, b, score]) => ({ a, b, score }))).onConflictDoNothing();
  }
  const opened = await refreshProperties([...dirty]);
  return { ids: [...dirty], opened };
}

export type Opened = { propertyId: number; mode: "aluguel" | "compra" };

/**
 * Last two distinct values of one price column of a listing: the current value, the one before
 * it and when the current value first appeared (another column changing does not hide a drop).
 */
async function lastChange(listingId: number, col: typeof priceHistory.rentCents | typeof priceHistory.salePriceCents): Promise<{ prev: number; current: number; at: Date } | null> {
  const rows = await getDb().select({ v: col, at: priceHistory.observedAt }).from(priceHistory).where(and(eq(priceHistory.listingId, listingId), sql`${col} is not null`)).orderBy(desc(priceHistory.observedAt), desc(priceHistory.id)).limit(60);
  let i = 1;
  while (i < rows.length && rows[i].v === rows[0].v) i++;
  return i < rows.length ? { prev: Number(rows[i].v), current: Number(rows[0].v), at: rows[i - 1].at } : null;
}

/**
 * Recomputes the aggregate of each property from its listings (or deletes empty ones).
 * Returns the properties that started being offered for rent or for sale.
 */
export async function refreshProperties(ids: number[]): Promise<Opened[]> {
  const db = getDb();
  const opened: Opened[] = [];
  for (const id of ids) {
    const [before] = await db.select({ forRent: properties.forRent, forSale: properties.forSale }).from(properties).where(eq(properties.id, id));
    const rows = await db
      .select({ l: listings, sourceKey: sources.key })
      .from(listings)
      .innerJoin(sources, eq(sources.id, listings.sourceId))
      .where(eq(listings.propertyId, id))
      .orderBy(asc(listings.id));
    if (!rows.length) {
      const [fav] = await db.select({ n: sql<number>`(count(*) + (select count(*) from price_watches w where w.property_id = ${id}))::int` }).from(favorites).where(eq(favorites.propertyId, id));
      if (!fav?.n) await db.delete(properties).where(eq(properties.id, id));
      else await db.update(properties).set({ status: "indisponivel", listingCount: 0, updatedAt: new Date() }).where(eq(properties.id, id));
      continue;
    }
    const ls = rows.map((r) => r.l);
    const best = Math.min(...ls.map((l) => STATUS_RANK[l.status] ?? 2));
    const pool = ls.filter((l) => (STATUS_RANK[l.status] ?? 2) === best);
    const rank = (l: (typeof ls)[number]) => STATUS_RANK[l.status] ?? 2;
    // Each mode has its own canonical listing: the cheapest offer for that deal at that deal's
    // best status (a sale listing missed once does not take the property out of buy mode while
    // its rent listing is still active; unavailable offers only count when nothing else is left).
    const byRent = (a: (typeof ls)[number], b: (typeof ls)[number]) => rank(a) - rank(b) || (a.rentCents ?? Infinity) - (b.rentCents ?? Infinity) || b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
    const bySale = (a: (typeof ls)[number], b: (typeof ls)[number]) => rank(a) - rank(b) || (a.salePriceCents ?? Infinity) - (b.salePriceCents ?? Infinity) || b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
    const eligible = (l: (typeof ls)[number]) => rank(l) <= Math.max(best, 1);
    const rentOffer = ls.filter((l) => eligible(l) && l.purposes.includes("aluguel") && l.rentCents != null).sort(byRent)[0] ?? null;
    const saleOffer = ls.filter((l) => eligible(l) && l.purposes.includes("compra") && l.salePriceCents != null).sort(bySale)[0] ?? null;
    const canonical = rentOffer ?? saleOffer ?? [...pool].sort(byRent)[0];
    const costSource = rentOffer ?? saleOffer ?? canonical;
    const cost = monthlyCost({ rentCents: rentOffer?.rentCents ?? null, condoCents: costSource.condoCents, iptuCents: costSource.iptuCents, iptuPeriod: costSource.iptuPeriod as IptuPeriod | null, otherFeesCents: costSource.otherFeesCents });
    const pick = <K extends keyof (typeof ls)[number]>(k: K) => (canonical[k] ?? ls.find((l) => l[k] != null)?.[k] ?? null) as (typeof ls)[number][K];
    const area = pick("areaM2");
    const ids = ls.map((l) => l.id);
    const firstOf = async (col: typeof priceHistory.rentCents | typeof priceHistory.salePriceCents) =>
      (await db.select({ v: col }).from(priceHistory).where(and(inArray(priceHistory.listingId, ids), sql`${col} is not null`)).orderBy(asc(priceHistory.observedAt)).limit(1))[0]?.v ?? null;
    const hist = rentOffer ? await lastChange(rentOffer.id, priceHistory.rentCents) : null;
    const drop = hist ? dropBp(hist.prev, hist.current) : null;
    const saleHist = saleOffer ? await lastChange(saleOffer.id, priceHistory.salePriceCents) : null;
    const saleDrop = saleHist ? dropBp(saleHist.prev, saleHist.current) : null;
    const first = { rent: await firstOf(priceHistory.rentCents) };
    const firstSale = await firstOf(priceHistory.salePriceCents);
    const [prop] = await db.select({ geoSource: properties.geoSource, lat: properties.lat, lng: properties.lng }).from(properties).where(eq(properties.id, id));
    const located = ls.find((l) => l.lat != null && l.lng != null && !l.addressHidden) ?? ls.find((l) => l.lat != null && l.lng != null);
    const location = located
      ? { lat: located.lat!, lng: located.lng!, geoPrecision: located.addressHidden ? "aproximada" : "exata", geoSource: "fonte" }
      : prop?.geoSource === "fonte" ? { lat: null, lng: null, geoPrecision: null, geoSource: null } : null;
    const moved = location != null && (location.lat !== prop?.lat || location.lng !== prop?.lng);
    const features = [...new Set(ls.flatMap((l) => l.features))];
    const neighborhood = pick("neighborhood");
    await db
      .update(properties)
      .set({
        title: pick("title"), type: pick("type"), neighborhood, neighborhoodKey: normalizeText(neighborhood) || null, street: pick("street"), number: pick("number"),
        areaM2: area, bedrooms: pick("bedrooms"), suites: pick("suites"), bathrooms: pick("bathrooms"), parking: pick("parking"), features,
        photo: ls.flatMap((l) => l.photos)[0] ?? null,
        rentCents: cost.rentCents, condoCents: cost.condoCents, iptuMonthlyCents: cost.iptuMonthlyCents, totalCents: cost.totalKnownCents, costStatus: cost.status,
        costPerM2Cents: costPerM2(cost.totalKnownCents, area), initialRentCents: first?.rent ?? null,
        dropBp: drop, droppedAt: drop && hist ? hist.at : null,
        forRent: Boolean(rentOffer), forSale: Boolean(saleOffer),
        salePriceCents: saleOffer?.salePriceCents ?? null, salePriceM2Cents: pricePerM2(saleOffer?.salePriceCents ?? null, area),
        initialSalePriceCents: firstSale, saleDropBp: saleDrop, saleDroppedAt: saleDrop && saleHist ? saleHist.at : null,
        listingCount: ls.length, advertiserTypes: [...new Set(ls.map((l) => l.advertiserType).filter((x): x is string => Boolean(x)))],
        sourceKeys: [...new Set(rows.map((r) => r.sourceKey))],
        status: (Object.keys(STATUS_RANK).find((k) => STATUS_RANK[k] === best) ?? "indisponivel"),
        isDemo: ls.every((l) => l.isDemo),
        firstSeenAt: new Date(Math.min(...ls.map((l) => l.firstSeenAt.getTime()))),
        lastSeenAt: new Date(Math.max(...ls.map((l) => l.lastSeenAt.getTime()))),
        updatedAt: new Date(),
        search: normalizeText([pick("title"), neighborhood, pick("street"), ls.map((l) => l.advertiserName).join(" ")].join(" ")),
        ...(location && moved
          ? { ...location, geom: location.lat == null ? null : sql`ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)`, analyzedAt: null, analysis: null, riskScore: null, riskLevel: null, floodLevel: null }
          : {}),
      })
      .where(eq(properties.id, id));
    if (rentOffer && !before?.forRent && rentOffer.status === "ativo") opened.push({ propertyId: id, mode: "aluguel" });
    if (saleOffer && !before?.forSale && saleOffer.status === "ativo") opened.push({ propertyId: id, mode: "compra" });
  }
  if (ids.length) await assignRegionals(ids);
  return opened;
}

/** Regional from the loaded regional polygons (PostGIS), when a location exists. */
export async function assignRegionals(ids?: number[]): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    update properties p set regional = a.name
    from areas a
    where a.kind = 'regional' and p.geom is not null and ST_Contains(a.geom, p.geom)
      and p.regional is distinct from a.name
      ${ids?.length ? sql`and p.id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})` : sql``}
  `);
}

/** Every property id that still has listings of other statuses (used by maintenance). */
export async function orphanProperties(): Promise<number[]> {
  const db = getDb();
  const rows = await db.select({ id: properties.id }).from(properties).where(and(ne(properties.listingCount, 0), sql`not exists (select 1 from listings l where l.property_id = ${properties.id})`));
  return rows.map((r) => r.id);
}
