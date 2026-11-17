import "server-only";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { geolocations, listings, properties } from "@/db/schema";
import { BH_BBOX, insideBh } from "@/domain/geo";
import { normalizeText } from "@/domain/text";
import { optionalEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { politeGap, safeFetch, USER_AGENT_BASE } from "../http";
import { assignRegionals } from "../collect/properties";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const RETRY_DAYS = 30;

type Hit = { lat: number; lng: number; precision: "exata" | "rua" | "bairro"; displayName: string | null; neighborhood: string | null; regional: string | null };

function userAgent(): string {
  const contact = optionalEnv("GEOCODER_CONTACT");
  return contact ? `${USER_AGENT_BASE} contato: ${contact}` : USER_AGENT_BASE;
}

/** One Nominatim request (≥ 1.1 s apart, bounded to BH). undefined = temporary failure (retry later). */
async function nominatim(params: Record<string, string>): Promise<Array<Record<string, unknown>> | undefined> {
  const q = new URLSearchParams({ format: "jsonv2", addressdetails: "1", limit: "1", countrycodes: "br", bounded: "1", viewbox: `${BH_BBOX.west},${BH_BBOX.north},${BH_BBOX.east},${BH_BBOX.south}`, ...params });
  await politeGap("nominatim", 1100);
  try {
    const res = await safeFetch(`${NOMINATIM}?${q}`, { timeoutMs: 15_000, maxBytes: 512 * 1024, accept: "application/json", headers: { "user-agent": userAgent() } });
    if (res.status === 429 || res.status >= 500) return undefined;
    if (res.status !== 200) return [];
    return JSON.parse(res.body.toString("utf8")) as Array<Record<string, unknown>>;
  } catch (err) {
    logger.warn({ msg: (err as Error).message }, "nominatim unavailable");
    return undefined;
  }
}

function toHit(r: Record<string, unknown> | undefined, wanted: "exata" | "rua" | "bairro"): Hit | null {
  if (!r) return null;
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!insideBh(lat, lng)) return null;
  const a = (r.address ?? {}) as Record<string, string>;
  const type = String(r.addresstype ?? r.type ?? "");
  const precision = wanted === "exata" && ["house", "building", "residential", "apartments"].includes(type) ? "exata" : wanted === "bairro" ? "bairro" : "rua";
  return { lat, lng, precision, displayName: String(r.display_name ?? "") || null, neighborhood: a.suburb ?? a.neighbourhood ?? a.quarter ?? null, regional: a.city_district ?? null };
}

/** Neighbourhood centre from the loaded areas (no network). */
async function bairroCentre(neighborhood: string): Promise<Hit | null> {
  const db = getDb();
  const rows = await db.execute<{ lat: number; lng: number }>(sql`
    select ST_Y(ST_PointOnSurface(geom)) as lat, ST_X(ST_PointOnSurface(geom)) as lng from areas
    where kind = 'bairro' and name_key = ${normalizeText(neighborhood)} limit 1`);
  const r = rows.rows[0];
  return r ? { lat: Number(r.lat), lng: Number(r.lng), precision: "bairro", displayName: null, neighborhood, regional: null } : null;
}

/** Address → coordinates, cached forever (failures too, as precision null). */
export async function geocodeAddress(input: { street: string | null; number: string | null; neighborhood: string | null }): Promise<Hit | null | undefined> {
  const db = getDb();
  const key = normalizeText(`${input.street ?? ""} ${input.number ?? ""} | ${input.neighborhood ?? ""}`);
  if (!key.replace(/\|/g, "").trim()) return null;
  const [cached] = await db.select().from(geolocations).where(eq(geolocations.addressKey, key)).limit(1);
  if (cached) return cached.lat == null ? null : { lat: cached.lat, lng: cached.lng!, precision: cached.precision as Hit["precision"], displayName: cached.displayName, neighborhood: cached.neighborhood, regional: cached.regional };
  let hit: Hit | null = null;
  if (input.street) {
    const street = input.number ? `${input.number} ${input.street}` : input.street;
    const res = await nominatim({ street, city: "Belo Horizonte", state: "Minas Gerais" });
    if (res === undefined) return undefined;
    hit = toHit(res[0], input.number ? "exata" : "rua");
  }
  if (!hit && input.neighborhood) {
    hit = await bairroCentre(input.neighborhood);
    if (!hit) {
      const res = await nominatim({ q: `${input.neighborhood}, Belo Horizonte, Minas Gerais` });
      if (res === undefined) return undefined;
      hit = toHit(res[0], "bairro");
    }
  }
  await db
    .insert(geolocations)
    .values({ addressKey: key, query: key, lat: hit?.lat ?? null, lng: hit?.lng ?? null, precision: hit?.precision ?? null, displayName: hit?.displayName ?? null, neighborhood: hit?.neighborhood ?? null, regional: hit?.regional ?? null })
    .onConflictDoNothing();
  return hit;
}

/** Locates properties without coordinates, best first; stops at the budget. Returns how many were tried. */
export async function geocodePending(deadline: number, max = 40): Promise<{ tried: number; located: number; remaining: boolean }> {
  const db = getDb();
  const retry = sql`now() - make_interval(days => ${RETRY_DAYS})`;
  const pending = await db
    .select({ id: properties.id, street: properties.street, number: properties.number, neighborhood: properties.neighborhood })
    .from(properties)
    .where(and(isNull(properties.geom), or(isNull(properties.geoTriedAt), lt(properties.geoTriedAt, retry)), sql`${properties.status} <> 'indisponivel'`))
    .orderBy(sql`${properties.firstSeenAt} desc`)
    .limit(max + 1);
  let tried = 0;
  let located = 0;
  const done: number[] = [];
  for (const p of pending.slice(0, max)) {
    if (Date.now() > deadline - 3_000) break;
    const hit = await geocodeAddress(p);
    if (hit === undefined) break; // geocoder unavailable: try again next run
    tried++;
    if (hit) {
      located++;
      done.push(p.id);
      await db.update(properties).set({ lat: hit.lat, lng: hit.lng, geom: sql`ST_SetSRID(ST_MakePoint(${hit.lng}, ${hit.lat}), 4326)`, geoPrecision: hit.precision, geoSource: hit.precision === "bairro" ? "bairro" : "nominatim", geoTriedAt: new Date(), analyzedAt: null, commuteAt: null }).where(eq(properties.id, p.id));
    } else {
      await db.update(properties).set({ geoTriedAt: new Date() }).where(eq(properties.id, p.id));
    }
  }
  if (done.length) await assignRegionals(done);
  return { tried, located, remaining: pending.length > tried };
}

/** Free-text place (search box, "distância de um endereço") → coordinates in BH. */
export async function geocodePlace(text: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const t = text.trim().slice(0, 120);
  if (t.length < 3) return null;
  const centre = await bairroCentre(t);
  if (centre) return { lat: centre.lat, lng: centre.lng, label: t };
  const res = await nominatim({ q: `${t}, Belo Horizonte, Minas Gerais` });
  const hit = toHit(res?.[0], "rua");
  return hit ? { lat: hit.lat, lng: hit.lng, label: hit.displayName?.split(",").slice(0, 2).join(",") ?? t } : null;
}

/** Listings' own coordinates count as located; used by tests and the admin panel. */
export async function locationStats(): Promise<{ total: number; located: number; approximate: number }> {
  const db = getDb();
  const [r] = await db
    .select({ total: sql<number>`count(*)::int`, located: sql<number>`count(${properties.geom})::int`, approximate: sql<number>`count(*) filter (where ${properties.geoPrecision} in ('bairro','aproximada'))::int` })
    .from(properties)
    .where(sql`${properties.status} <> 'indisponivel' and exists (select 1 from ${listings} where ${listings.propertyId} = ${properties.id})`);
  return r ?? { total: 0, located: 0, approximate: 0 };
}
