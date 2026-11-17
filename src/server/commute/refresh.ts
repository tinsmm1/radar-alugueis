import "server-only";
import { and, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { commuteTrips, properties } from "@/db/schema";
import { modelTrip, nextDepartAt, summarise, weekendOnly, type CommuteSummary, type Trip } from "@/domain/commute";
import { locatedWorkplaces, workplaceSignature, type Profile, type Workplace } from "@/domain/profile";
import { loadProfile } from "../profile";
import { tomtomEnabled, tomtomRoutes, tomtomTrip, type TomtomBudget } from "./tomtom";

type Located = Workplace & { lat: number; lng: number };
type Point = { id: number; lat: number; lng: number };

const signature = (w: Located, p: Point, dir: Trip["direction"]) => `${workplaceSignature(w)}|${p.lat.toFixed(5)},${p.lng.toFixed(5)}|${dir}`;
const UPGRADE_AFTER_DAYS = 7;

/** Both directions for one property and workplace: TomTom when possible, otherwise the model. */
async function tripsFor(w: Located, p: Point, budget: TomtomBudget | null): Promise<{ ida: Trip; volta: Trip }> {
  const weekend = weekendOnly(w.days);
  const api = budget != null && !budget.exhausted && tomtomRoutes(w.mode);
  const ida = (api && (await tomtomTrip(p, w, w.mode, nextDepartAt(w.departure, w.days), "ida", w.departure, budget))) || modelTrip(p, w, w.mode, w.departure, "ida", weekend);
  const volta = (api && !budget.exhausted && (await tomtomTrip(w, p, w.mode, nextDepartAt(w.returnAt, w.days), "volta", w.returnAt, budget))) || modelTrip(w, p, w.mode, w.returnAt, "volta", weekend);
  return { ida, volta };
}

const fromRow = (r: typeof commuteTrips.$inferSelect): Trip => ({
  direction: r.direction as Trip["direction"], mode: r.mode as Trip["mode"], minutes: r.minutes, minMinutes: r.minMinutes, maxMinutes: r.maxMinutes,
  freeFlowMinutes: r.freeFlowMinutes, distanceKm: r.distanceKm, method: r.method as Trip["method"], at: r.at,
});

/** Commute for one point using cached trips where valid; writes new trips to the cache. */
async function commuteOf(profile: Profile, wps: Located[], p: Point, cached: Map<string, typeof commuteTrips.$inferSelect>, budget: TomtomBudget | null): Promise<CommuteSummary | null> {
  const db = getDb();
  const out: Array<{ workplace: Workplace; ida: Trip; volta: Trip }> = [];
  for (const w of wps) {
    const ci = cached.get(`${p.id}|${w.id}|ida`);
    const cv = cached.get(`${p.id}|${w.id}|volta`);
    const fresh = (c: typeof ci, dir: Trip["direction"]) =>
      c && c.signature === signature(w, p, dir) && !(c.method === "modelo" && budget != null && !budget.exhausted && tomtomRoutes(w.mode) && Date.now() - c.computedAt.getTime() > UPGRADE_AFTER_DAYS * 86_400_000);
    if (fresh(ci, "ida") && fresh(cv, "volta")) {
      out.push({ workplace: w, ida: fromRow(ci!), volta: fromRow(cv!) });
      continue;
    }
    const t = await tripsFor(w, p, budget);
    out.push({ workplace: w, ...t });
    for (const trip of [t.ida, t.volta]) {
      const row = {
        propertyId: p.id, workplaceId: w.id, direction: trip.direction, mode: trip.mode, signature: signature(w, p, trip.direction), minutes: trip.minutes, minMinutes: trip.minMinutes,
        maxMinutes: trip.maxMinutes, freeFlowMinutes: trip.freeFlowMinutes, distanceKm: trip.distanceKm, method: trip.method, at: trip.at, computedAt: new Date(),
      };
      await db.insert(commuteTrips).values(row).onConflictDoUpdate({ target: [commuteTrips.propertyId, commuteTrips.workplaceId, commuteTrips.direction], set: row });
    }
  }
  return summarise(profile, out);
}

/**
 * Stage "deslocamento" of the daily run: for active, located properties whose commute is
 * missing, older than the profile, or older than 30 days, computes the trips to every
 * workplace at the owner's times and stores the summary (properties.commute, commute_minutes).
 * With a TomTom key, a second pass upgrades model trips (older than 7 days) of the best-graded
 * offers first, so the daily request budget goes to the homes the owner is likely to visit.
 */
export async function refreshCommutes(deadline: number, max = 300): Promise<{ updated: number; remaining: boolean }> {
  const db = getDb();
  const profile = await loadProfile();
  const wps = locatedWorkplaces(profile);
  if (!wps.length) {
    await db.update(properties).set({ commute: null, commuteMinutes: null, commuteAt: null }).where(isNotNull(properties.commute));
    return { updated: 0, remaining: false };
  }
  const saved = profile.updatedAt ? new Date(profile.updatedAt) : null;
  const since = saved && !Number.isNaN(saved.getTime()) ? saved : new Date(0);
  const best = sql`greatest(coalesce(${properties.rentEvalScore}, 0), coalesce(${properties.saleEvalScore}, 0)) desc`;
  const located = and(eq(properties.status, "ativo"), isNotNull(properties.lat), isNotNull(properties.lng));
  let todo = (await db
    .select({ id: properties.id, lat: properties.lat, lng: properties.lng })
    .from(properties)
    .where(and(located, sql`(${properties.commuteAt} is null or ${properties.commuteAt} < ${since} or ${properties.commuteAt} < now() - interval '30 days')`))
    .orderBy(sql`${properties.commuteAt} asc nulls first`, best)
    .limit(max + 1)) as Point[];
  const budget: TomtomBudget | null = tomtomEnabled() ? { exhausted: false } : null;
  let upgrading = false;
  if (!todo.length && budget) {
    todo = (await db
      .select({ id: properties.id, lat: properties.lat, lng: properties.lng })
      .from(properties)
      .where(and(located, sql`${properties.commute}->>'method' <> 'tomtom' and ${properties.commuteAt} < now() - make_interval(days => ${UPGRADE_AFTER_DAYS})`))
      .orderBy(best)
      .limit(Math.min(max, 100) + 1)) as Point[];
    upgrading = todo.length > 0;
  }
  if (!todo.length) return { updated: 0, remaining: false };
  const batch = todo.slice(0, max);
  const cachedRows = await db.select().from(commuteTrips).where(inArray(commuteTrips.propertyId, batch.map((p) => p.id)));
  const cached = new Map<string, typeof commuteTrips.$inferSelect>(cachedRows.map((r: typeof commuteTrips.$inferSelect) => [`${r.propertyId}|${r.workplaceId}|${r.direction}`, r]));
  let updated = 0;
  for (const p of batch) {
    if (Date.now() > deadline - 4_000) return { updated, remaining: true };
    if (upgrading && budget?.exhausted) break;
    const summary = await commuteOf(profile, wps, p, cached, Date.now() < deadline - 10_000 ? budget : null);
    await db.update(properties).set({ commute: summary, commuteMinutes: summary?.avgOneWayMin ?? null, commuteAt: new Date() }).where(eq(properties.id, p.id));
    updated++;
  }
  // Upgrades never keep the run going: they continue on the next run while the budget lasts.
  return { updated, remaining: !upgrading && todo.length > max };
}

/** Removes cached trips of workplaces that left the profile (called when the profile is saved). */
export async function pruneTrips(workplaceIds: string[]): Promise<void> {
  const db = getDb();
  if (!workplaceIds.length) await db.delete(commuteTrips).where(sql`true`); // no workplace left: drop every cached trip
  else await db.delete(commuteTrips).where(notInArray(commuteTrips.workplaceId, workplaceIds));
}

/** Model-only commute for a point (property page before the next run; no API calls, no cache). */
export function quickCommute(profile: Profile, point: { lat: number; lng: number }): CommuteSummary | null {
  const wps = locatedWorkplaces(profile);
  return summarise(profile, wps.map((w) => ({
    workplace: w,
    ida: modelTrip(point, w, w.mode, w.departure, "ida", weekendOnly(w.days)),
    volta: modelTrip(w, point, w.mode, w.returnAt, "volta", weekendOnly(w.days)),
  })));
}
