import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { favorites, listings, notifications, priceWatches, properties, savedSearches } from "@/db/schema";
import { filterFromParams } from "@/domain/filters";
import type { ListingEvent } from "../collect/ingest";
import type { Opened } from "../collect/properties";
import { matchingIds } from "../search";

export type NotificationKind = "novo" | "baixa_preco" | "preco_alvo" | "perfil" | "indisponivel" | "voltou" | "fonte_falhou";

export const KIND_LABEL: Record<NotificationKind, string> = {
  novo: "Novo imóvel na sua busca",
  baixa_preco: "Preço reduzido",
  preco_alvo: "Preço-alvo atingido",
  perfil: "Oportunidade para o seu perfil",
  indisponivel: "Ficou indisponível",
  voltou: "Voltou a ser anunciado",
  fonte_falhou: "Fonte com falha",
};

const day = () => new Date().toISOString().slice(0, 10);
type Mode = "aluguel" | "compra";

/**
 * Turns collection results into notifications, one per kind/property/mode/search/day:
 * - saved searches: properties that started being offered in the search's mode ("novo", so a
 *   second agency advertising a known home is not news) and price drops of that mode;
 * - followed properties (favourites or price watches): drops per mode, unavailability, return.
 */
export async function notificationsFor(events: ListingEvent[], opened: Opened[] = []): Promise<number> {
  const db = getDb();
  const ids = [...new Set(events.map((e) => e.listingId))];
  const rows = ids.length ? await db.select({ id: listings.id, propertyId: listings.propertyId, isDemo: listings.isDemo }).from(listings).where(inArray(listings.id, ids)) : [];
  const propertyOf = new Map(rows.filter((r) => !r.isDemo && r.propertyId != null).map((r) => [r.id, r.propertyId!]));
  const demoProps = opened.length ? new Set((await db.select({ id: properties.id }).from(properties).where(and(inArray(properties.id, opened.map((o) => o.propertyId)), eq(properties.isDemo, true)))).map((r) => r.id)) : new Set<number>();
  // Keys: "novo:<mode>", "baixa_preco:<mode>", "indisponivel", "voltou".
  const byKey = new Map<string, { propertyIds: Set<number>; drop: Map<number, number> }>();
  const add = (key: string, pid: number, dropBp?: number) => {
    const entry = byKey.get(key) ?? { propertyIds: new Set(), drop: new Map() };
    entry.propertyIds.add(pid);
    if (dropBp) entry.drop.set(pid, Math.max(entry.drop.get(pid) ?? 0, dropBp));
    byKey.set(key, entry);
  };
  for (const o of opened) if (!demoProps.has(o.propertyId)) add(`novo:${o.mode}`, o.propertyId);
  for (const e of events) {
    const pid = propertyOf.get(e.listingId);
    if (pid == null || e.kind === "novo") continue;
    add(e.kind === "baixa_preco" ? `baixa_preco:${e.mode ?? "aluguel"}` : e.kind, pid, e.dropBp);
  }
  if (!byKey.size) return 0;
  const values: Array<typeof notifications.$inferInsert> = [];
  const searches = await db.select().from(savedSearches);
  for (const s of searches) {
    const f = filterFromParams(new URLSearchParams(s.query));
    for (const kind of ["novo", "baixa_preco"] as const) {
      if ((kind === "novo" && !s.notifyNew) || (kind === "baixa_preco" && !s.notifyDrop)) continue;
      const entry = byKey.get(`${kind}:${f.modo}`);
      for (const pid of await matchingIds(f, [...(entry?.propertyIds ?? [])])) {
        values.push({ kind, propertyId: pid, savedSearchId: s.id, dedupKey: `${kind}:${f.modo}:${pid}:${s.id}:${day()}`, payload: { search: s.name, mode: f.modo, dropBp: entry?.drop.get(pid) ?? null } });
      }
    }
  }
  const followed = await followedIds([...byKey.values()].flatMap((e) => [...e.propertyIds]));
  for (const mode of ["aluguel", "compra"] as const) {
    const entry = byKey.get(`baixa_preco:${mode}`);
    for (const pid of entry?.propertyIds ?? []) {
      if (followed.has(pid)) values.push({ kind: "baixa_preco", propertyId: pid, dedupKey: `baixa_preco:${mode}:${pid}:fav:${day()}`, payload: { favorite: true, mode, dropBp: entry?.drop.get(pid) ?? null } });
    }
  }
  for (const kind of ["indisponivel", "voltou"] as const) {
    for (const pid of byKey.get(kind)?.propertyIds ?? []) {
      if (followed.has(pid)) values.push({ kind, propertyId: pid, dedupKey: `${kind}:${pid}:fav:${day()}`, payload: { favorite: true } });
    }
  }
  if (!values.length) return 0;
  const inserted = await db.insert(notifications).values(values).onConflictDoNothing().returning({ id: notifications.id });
  return inserted.length;
}

/** Properties the owner follows: in a favourite list or with a price watch. */
async function followedIds(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const db = getDb();
  const fav = await db.selectDistinct({ id: favorites.propertyId }).from(favorites).where(inArray(favorites.propertyId, ids));
  const watched = await db.selectDistinct({ id: priceWatches.propertyId }).from(priceWatches).where(inArray(priceWatches.propertyId, ids));
  return new Set([...fav, ...watched].map((r) => r.id));
}

/** SQL price a watch follows: known monthly total (or the rent) for rent, asking price for buy. */
export const watchedPrice = (mode: Mode) => (mode === "compra" ? sql`p.sale_price_cents` : sql`coalesce(p.total_cents, p.rent_cents)`);

/**
 * Price targets: one "preco_alvo" notification when a followed property's current price is at
 * or below the owner's target; again only if it falls further. Demo properties are ignored.
 */
export async function checkPriceTargets(): Promise<number> {
  const db = getDb();
  let created = 0;
  for (const mode of ["aluguel", "compra"] as const) {
    const price = watchedPrice(mode);
    const { rows } = await db.execute<{ id: number; property_id: number; target: number; price: number }>(sql`
      select w.id, w.property_id, w.target_cents::bigint as target, (${price})::bigint as price
      from price_watches w join properties p on p.id = w.property_id
      where w.mode = ${mode} and w.target_cents is not null and p.status = 'ativo' and not p.is_demo
        and ${mode === "compra" ? sql`p.for_sale` : sql`p.for_rent`} and ${price} is not null and ${price} <= w.target_cents
        and (w.notified_price_cents is null or ${price} < w.notified_price_cents)`);
    for (const r of rows) {
      const inserted = await db
        .insert(notifications)
        .values({ kind: "preco_alvo", propertyId: r.property_id, dedupKey: `preco_alvo:${mode}:${r.property_id}:${r.price}`, payload: { mode, targetCents: Number(r.target), priceCents: Number(r.price) } })
        .onConflictDoNothing()
        .returning({ id: notifications.id });
      created += inserted.length;
      await db.update(priceWatches).set({ notifiedPriceCents: Number(r.price), notifiedAt: new Date() }).where(eq(priceWatches.id, r.id));
    }
  }
  return created;
}

export async function sourceFailed(sourceName: string, error: string): Promise<void> {
  await getDb()
    .insert(notifications)
    .values({ kind: "fonte_falhou", dedupKey: `fonte_falhou:${sourceName}:${day()}`, payload: { source: sourceName, error: error.slice(0, 300) } })
    .onConflictDoNothing();
}

export async function unreadCount(): Promise<number> {
  const [r] = await getDb().execute<{ n: number }>(sql`select count(*)::int as n from notifications n, settings s where s.id = 1 and n.created_at > coalesce(s.notifications_seen_at, 'epoch')`).then((x) => x.rows);
  return r?.n ?? 0;
}
