import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { listings, listingsRaw, priceHistory, sources } from "@/db/schema";
import { iptuPerMonth } from "@/domain/cost";
import { priceChanged, reconcileMissing, type ListingStatus } from "@/domain/lifecycle";
import type { NormalizedListing } from "@/domain/listing";

export type IngestStats = { fetched: number; created: number; updated: number; unchanged: number; priceChanges: number; missing: number; back: number; partial: boolean; touched: number[] };
export type ListingEvent = { listingId: number; kind: "novo" | "baixa_preco" | "indisponivel" | "voltou"; dropBp?: number; mode?: "aluguel" | "compra" };

const hashOf = (l: NormalizedListing) => createHash("sha256").update(JSON.stringify(l)).digest("hex").slice(0, 32);
const total = (l: Pick<NormalizedListing, "rentCents" | "condoCents" | "iptuCents" | "iptuPeriod" | "otherFeesCents">) =>
  l.rentCents == null ? null : l.rentCents + (l.condoCents ?? 0) + (l.iptuCents == null ? 0 : iptuPerMonth(l.iptuCents, l.iptuPeriod, l.rentCents)) + (l.otherFeesCents ?? 0);

function columns(l: NormalizedListing) {
  return {
    purposes: l.purposes, salePriceCents: l.salePriceCents,
    url: l.url, title: l.title, description: l.description, type: l.type, rentCents: l.rentCents, condoCents: l.condoCents, iptuCents: l.iptuCents,
    iptuPeriod: l.iptuPeriod, otherFeesCents: l.otherFeesCents, feesNote: l.feesNote, areaM2: l.areaM2, bedrooms: l.bedrooms, suites: l.suites,
    bathrooms: l.bathrooms, parking: l.parking, features: l.features, advertiserType: l.advertiserType, advertiserName: l.advertiserName, photos: l.photos,
    street: l.street, number: l.number, neighborhood: l.neighborhood, city: l.city, postalCode: l.postalCode, lat: l.lat, lng: l.lng, addressHidden: l.addressHidden,
  };
}

/**
 * Stores one source's listings in a single transaction (serialized per source):
 * raw payload (deduped by hash) → normalized upsert → price history → availability.
 * Returns stats, events for notifications and the touched listing ids (for grouping).
 */
export async function ingest(sourceId: number, items: NormalizedListing[], raws: Record<string, unknown>, opts: { fullSnapshot: boolean; isDemo?: boolean; now?: Date }): Promise<{ stats: IngestStats; events: ListingEvent[] }> {
  const now = opts.now ?? new Date();
  const events: ListingEvent[] = [];
  const stats: IngestStats = { fetched: items.length, created: 0, updated: 0, unchanged: 0, priceChanges: 0, missing: 0, back: 0, partial: false, touched: [] };
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7400000, ${sourceId})`);
    const existing = await tx
      .select({ id: listings.id, externalId: listings.externalId, status: listings.status, missingCount: listings.missingCount, lastSeenAt: listings.lastSeenAt, rentCents: listings.rentCents, condoCents: listings.condoCents, iptuCents: listings.iptuCents, salePriceCents: listings.salePriceCents, rawId: listings.rawId })
      .from(listings)
      .where(eq(listings.sourceId, sourceId));
    const byExt = new Map(existing.map((e) => [e.externalId, e]));
    const lastHash = new Map<number, string>();
    const rawIds = existing.map((e) => e.rawId).filter((x): x is number => x != null);
    for (let i = 0; i < rawIds.length; i += 1000) {
      const rows = await tx.select({ id: listingsRaw.id, hash: listingsRaw.hash }).from(listingsRaw).where(inArray(listingsRaw.id, rawIds.slice(i, i + 1000)));
      for (const r of rows) lastHash.set(r.id, r.hash);
    }

    for (const l of items) {
      const hash = hashOf(l);
      const prev = byExt.get(l.externalId);
      if (prev && prev.rawId != null && lastHash.get(prev.rawId) === hash && prev.status === "ativo") {
        await tx.update(listings).set({ lastSeenAt: now, lastCheckedAt: now, missingCount: 0 }).where(eq(listings.id, prev.id));
        stats.unchanged++;
        continue;
      }
      const [raw] = await tx
        .insert(listingsRaw)
        .values({ sourceId, externalId: l.externalId, hash, payload: raws[l.externalId] ?? l, fetchedAt: now })
        .onConflictDoUpdate({ target: [listingsRaw.sourceId, listingsRaw.externalId, listingsRaw.hash], set: { fetchedAt: now } })
        .returning({ id: listingsRaw.id });
      if (!prev) {
        const [row] = await tx
          .insert(listings)
          .values({ sourceId, externalId: l.externalId, rawId: raw.id, ...columns(l), isDemo: Boolean(opts.isDemo), firstSeenAt: now, lastSeenAt: now, lastCheckedAt: now, updatedAt: now })
          .returning({ id: listings.id });
        await tx.insert(priceHistory).values({ listingId: row.id, rentCents: l.rentCents, condoCents: l.condoCents, iptuCents: l.iptuCents, totalCents: total(l), salePriceCents: l.salePriceCents, observedAt: now });
        events.push({ listingId: row.id, kind: "novo" });
        stats.created++;
        stats.touched.push(row.id);
        continue;
      }
      const changed = priceChanged(prev, l);
      await tx
        .update(listings)
        .set({ ...columns(l), rawId: raw.id, status: "ativo", missingCount: 0, lastSeenAt: now, lastCheckedAt: now, updatedAt: now, ...(changed ? { priceChangedAt: now } : {}) })
        .where(eq(listings.id, prev.id));
      if (changed) {
        await tx.insert(priceHistory).values({ listingId: prev.id, rentCents: l.rentCents, condoCents: l.condoCents, iptuCents: l.iptuCents, totalCents: total(l), salePriceCents: l.salePriceCents, observedAt: now });
        stats.priceChanges++;
        if (prev.rentCents != null && l.rentCents != null && l.rentCents < prev.rentCents) events.push({ listingId: prev.id, kind: "baixa_preco", mode: "aluguel", dropBp: Math.round(((prev.rentCents - l.rentCents) / prev.rentCents) * 10_000) });
        if (prev.salePriceCents != null && l.salePriceCents != null && l.salePriceCents < prev.salePriceCents) events.push({ listingId: prev.id, kind: "baixa_preco", mode: "compra", dropBp: Math.round(((prev.salePriceCents - l.salePriceCents) / prev.salePriceCents) * 10_000) });
      }
      if (prev.status !== "ativo") {
        events.push({ listingId: prev.id, kind: "voltou" });
        stats.back++;
      }
      stats.updated++;
      stats.touched.push(prev.id);
    }

    const seen = new Set(items.map((l) => l.externalId));
    const { transitions, partial } = reconcileMissing(
      existing.map((e) => ({ externalId: e.externalId, status: e.status as ListingStatus, missingCount: e.missingCount, lastSeenAt: e.lastSeenAt })),
      seen,
      now,
      opts.fullSnapshot,
    );
    stats.partial = partial;
    for (const t of transitions) {
      const prev = byExt.get(t.externalId)!;
      await tx.update(listings).set({ status: t.status, missingCount: t.missingCount, lastCheckedAt: now }).where(eq(listings.id, prev.id));
      if (t.event === "indisponivel") events.push({ listingId: prev.id, kind: "indisponivel" });
      stats.missing++;
      stats.touched.push(prev.id);
    }
    await tx.update(sources).set({ lastRunAt: now, lastOkAt: now, lastError: null, consecutiveFailures: 0 }).where(eq(sources.id, sourceId));
  });
  return { stats, events };
}

/** Removes every listing of a source (used to delete demo data); properties are regrouped after. */
export async function purgeSource(sourceId: number): Promise<number[]> {
  const db = getDb();
  const rows = await db.delete(listings).where(and(eq(listings.sourceId, sourceId))).returning({ propertyId: listings.propertyId });
  return [...new Set(rows.map((r) => r.propertyId).filter((x): x is number => x != null))];
}
