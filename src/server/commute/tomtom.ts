import "server-only";
import { z } from "zod";
import type { CommuteMode } from "@/domain/profile";
import type { Trip } from "@/domain/commute";
import { optionalEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeFetch } from "../http";
import { hit } from "../rate-limit";

/**
 * TomTom Routing API (calculateRoute) with `departAt`: the travel time includes historic and
 * live traffic for that clock time. Used for car, bicycle and walking; buses are not routed by
 * TomTom and stay on the model. Free tier: 2,500 non-tile requests/day; the Radar keeps under
 * TOMTOM_DAILY_BUDGET (default 2000) with a Postgres counter.
 */
const TRAVEL_MODE: Partial<Record<CommuteMode, string>> = { carro: "car", bicicleta: "bicycle", a_pe: "pedestrian" };

const responseSchema = z.object({
  routes: z.array(z.object({
    summary: z.object({
      lengthInMeters: z.number(),
      travelTimeInSeconds: z.number(),
      noTrafficTravelTimeInSeconds: z.number().optional(),
      historicTrafficTravelTimeInSeconds: z.number().optional(),
    }),
  })).min(1),
});

export const tomtomEnabled = () => Boolean(optionalEnv("TOMTOM_API_KEY"));
/** Per-run state: once the daily budget is used up, no more counter writes or requests this run. */
export type TomtomBudget = { exhausted: boolean };
export const tomtomRoutes = (mode: CommuteMode) => Boolean(TRAVEL_MODE[mode]);

/** One trip, or null when unavailable (no key, mode not routed, budget used up, error). */
export async function tomtomTrip(from: { lat: number; lng: number }, to: { lat: number; lng: number }, mode: CommuteMode, departAt: string, direction: Trip["direction"], at: string, state: TomtomBudget = { exhausted: false }): Promise<Trip | null> {
  const key = optionalEnv("TOMTOM_API_KEY");
  const travelMode = TRAVEL_MODE[mode];
  if (!key || !travelMode || state.exhausted) return null;
  const limit = Number(optionalEnv("TOMTOM_DAILY_BUDGET") ?? 2000);
  if (!(await hit(`tomtom:${new Date().toISOString().slice(0, 10)}`, limit, 86_400))) {
    state.exhausted = true;
    return null;
  }
  const path = `${from.lat.toFixed(6)},${from.lng.toFixed(6)}:${to.lat.toFixed(6)},${to.lng.toFixed(6)}`;
  const qs = new URLSearchParams({ key, departAt, traffic: "true", travelMode, routeType: "fastest", computeTravelTimeFor: "all", routeRepresentation: "summaryOnly" });
  try {
    const res = await safeFetch(`https://api.tomtom.com/routing/1/calculateRoute/${path}/json?${qs}`, { accept: "application/json", timeoutMs: 12_000, maxBytes: 512 * 1024, allowRedirectTo: () => false });
    if (res.status === 403 || res.status === 429) state.exhausted = true; // key refused or quota reached upstream
    if (res.status !== 200) {
      logger.warn({ status: res.status }, "tomtom route failed");
      return null;
    }
    const parsed = responseSchema.safeParse(JSON.parse(res.body.toString("utf8")));
    if (!parsed.success) return null;
    const s = parsed.data.routes[0].summary;
    const minutes = Math.max(1, Math.round(s.travelTimeInSeconds / 60) + (mode === "carro" ? 4 : 0)); // + parking and walking
    const free = s.noTrafficTravelTimeInSeconds != null ? Math.round(s.noTrafficTravelTimeInSeconds / 60) + (mode === "carro" ? 3 : 0) : null;
    return { direction, mode, minutes, minMinutes: Math.min(minutes, free ?? minutes), maxMinutes: Math.round(minutes * 1.15), freeFlowMinutes: free, distanceKm: Math.round(s.lengthInMeters / 100) / 10, method: "tomtom", at };
  } catch (err) {
    logger.warn({ msg: (err as Error).message.slice(0, 200) }, "tomtom route error");
    return null;
  }
}
