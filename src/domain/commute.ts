import { haversine } from "./geo";
import { COMMUTE_MODE_LABEL, type CommuteMode, type Profile, type Workplace } from "./profile";

/**
 * Door-to-door commute estimates at the owner's own times (ida and volta).
 *
 * Two methods, always labelled to the user:
 * - "tomtom": TomTom Routing API with `departAt` (historic + live traffic) for car, bicycle and
 *   walking, when TOMTOM_API_KEY is set (server side, see src/server/commute).
 * - "modelo": a transparent model calibrated with public BH figures, used without the key and
 *   always for public transport (TomTom does not route buses):
 *   - car: TomTom Traffic Index 2025 for Belo Horizonte — 10 km take ~35 min in the morning rush
 *     (17.1 km/h, congestion level ~91–93%) → free flow ≈ 33 km/h; the hourly curve below
 *     multiplies the free-flow time (≈1.9× at 7–9 h and 17–19 h);
 *   - bus: PBH/Sumob, average bus speed at peak ≈ 14.2 km/h (2024), ≈ 17 km/h off-peak, plus
 *     walking to the stop, average wait and one transfer on long trips;
 *   - road distance = straight line × 1.35 (urban circuity assumption).
 * Results are ranges, never promises; the UI says which method produced each number.
 */
export type TripMethod = "tomtom" | "modelo";
export type Trip = {
  direction: "ida" | "volta";
  mode: CommuteMode;
  minutes: number;
  /** Range shown to the user (model ±25%; TomTom: no-traffic time to traffic time + 15%). */
  minMinutes: number;
  maxMinutes: number;
  freeFlowMinutes: number | null;
  distanceKm: number;
  method: TripMethod;
  at: string; // HH:MM
};

export const CIRCUITY = 1.35;
export const CAR_FREE_FLOW_KMH = 33;
export const BUS_PEAK_KMH = 14.2;
export const BUS_OFFPEAK_KMH = 17;
export const BIKE_KMH = 14;
export const WALK_KMH = 4.8;
export const COMMUTE_SOURCES = [
  { label: "TomTom Traffic Index 2025 · Belo Horizonte", url: "https://www.tomtom.com/traffic-index/belo-horizonte-traffic" },
  { label: "PBH · Programa de redução do tempo de viagem no transporte coletivo", url: "https://prefeitura.pbh.gov.br/mobilidade-urbana/programa-de-reducao-do-tempo-de-viagem-no-transporte-coletivo" },
] as const;
export const COMMUTE_NOTE =
  "Tempos porta a porta estimados nos seus horários. Com a chave da TomTom, carro, bicicleta e a pé usam o trânsito histórico do horário; ônibus e metrô usam um modelo calibrado com dados públicos de BH. São faixas, não garantias.";

/** Weekday congestion multiplier over free flow, by hour (BH; peaks ≈ TomTom rush-hour level). */
const WEEKDAY = [1.05, 1.03, 1.02, 1.02, 1.05, 1.15, 1.4, 1.85, 1.93, 1.62, 1.45, 1.45, 1.5, 1.5, 1.45, 1.5, 1.6, 1.88, 1.95, 1.7, 1.4, 1.25, 1.15, 1.1];
const WEEKEND = [1.05, 1.03, 1.02, 1.02, 1.02, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.35, 1.3, 1.3, 1.3, 1.3, 1.35, 1.35, 1.3, 1.25, 1.2, 1.12, 1.08];

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Congestion factor at a clock time, interpolated between hour centres. */
export function congestionFactor(hhmm: string, weekend = false): number {
  const curve = weekend ? WEEKEND : WEEKDAY;
  const t = toMin(hhmm) / 60 - 0.5;
  const h0 = ((Math.floor(t) % 24) + 24) % 24;
  const h1 = (h0 + 1) % 24;
  const frac = t - Math.floor(t);
  return Math.round((curve[h0] * (1 - frac) + curve[h1] * frac) * 1000) / 1000;
}

export const isPeak = (hhmm: string) => {
  const m = toMin(hhmm);
  return (m >= 6 * 60 && m < 9 * 60 + 30) || (m >= 16 * 60 + 30 && m < 19 * 60 + 30);
};

type Point = { lat: number; lng: number };

/** Model estimate for one trip (see the header for calibration). */
export function modelTrip(from: Point, to: Point, mode: CommuteMode, at: string, direction: Trip["direction"], weekend = false): Trip {
  const straight = haversine(from.lat, from.lng, to.lat, to.lng) / 1000;
  const roadKm = Math.round(straight * (mode === "a_pe" ? 1.25 : CIRCUITY) * 10) / 10;
  let minutes: number;
  let freeFlow: number | null = null;
  if (mode === "carro") {
    freeFlow = (roadKm / CAR_FREE_FLOW_KMH) * 60 + 3;
    minutes = (roadKm / CAR_FREE_FLOW_KMH) * 60 * congestionFactor(at, weekend) + 4; // + parking and walking
  } else if (mode === "onibus") {
    const speed = isPeak(at) && !weekend ? BUS_PEAK_KMH : BUS_OFFPEAK_KMH;
    const walk = roadKm < 1.2 ? 0 : 10; // ~400 m to the stop on each end
    const wait = isPeak(at) ? 7 : 10;
    const transfer = roadKm > 8 ? 8 : 0;
    minutes = roadKm < 1.2 ? (roadKm / WALK_KMH) * 60 : (roadKm / speed) * 60 + walk + wait + transfer;
  } else if (mode === "bicicleta") minutes = (roadKm / BIKE_KMH) * 60 + 2;
  else minutes = (roadKm / WALK_KMH) * 60;
  const m = Math.max(1, Math.round(minutes));
  return { direction, mode, minutes: m, minMinutes: Math.max(1, Math.round(m * 0.8)), maxMinutes: Math.round(m * 1.25), freeFlowMinutes: freeFlow == null ? null : Math.round(freeFlow), distanceKm: roadKm, method: "modelo", at };
}

/** One workplace: both directions, its weekly frequency and money/time costs. */
export type WorkplaceCommute = {
  workplaceId: string;
  name: string;
  mode: CommuteMode;
  ida: Trip;
  volta: Trip;
  daysPerWeek: number;
  weight: number;
  monthlyHours: number;
  monthlyCostCents: number;
  monthlyTimeCostCents: number;
};

export type CommuteSummary = {
  /** Weighted average one-way minutes across workplaces (ida and volta averaged). */
  avgOneWayMin: number;
  /** Worst one-way trip (minutes) and its workplace. */
  worstOneWayMin: number;
  worstName: string;
  monthlyHours: number;
  monthlyCostCents: number;
  monthlyTimeCostCents: number;
  method: TripMethod | "misto";
  workplaces: WorkplaceCommute[];
  computedAt: string;
};

const WEEKS_PER_MONTH = 52 / 12;

/** Money per month for one workplace (car: km × cost + parking; bus: fares, ×1.6 with a transfer). */
export function tripCostsCents(p: Profile, w: Pick<Workplace, "mode" | "days">, ida: Trip, volta: Trip): number {
  const days = w.days.length * WEEKS_PER_MONTH;
  if (w.mode === "carro") return Math.round(((ida.distanceKm + volta.distanceKm) * p.carCostPerKmCents + p.parkingPerDayCents) * days);
  if (w.mode === "onibus") {
    const fare = (t: Trip) => (t.distanceKm < 1.2 ? 0 : t.distanceKm > 8 ? p.transitFareCents * 1.6 : p.transitFareCents);
    return Math.round((fare(ida) + fare(volta)) * days);
  }
  return 0;
}

export function summarise(p: Profile, trips: Array<{ workplace: Workplace; ida: Trip; volta: Trip }>, now = new Date()): CommuteSummary | null {
  if (!trips.length) return null;
  const workplaces: WorkplaceCommute[] = trips.map(({ workplace: w, ida, volta }) => {
    const monthlyHours = ((ida.minutes + volta.minutes) * w.days.length * WEEKS_PER_MONTH) / 60;
    return {
      workplaceId: w.id, name: w.name, mode: w.mode, ida, volta, daysPerWeek: w.days.length, weight: w.weight,
      monthlyHours: Math.round(monthlyHours * 10) / 10,
      monthlyCostCents: tripCostsCents(p, w, ida, volta),
      monthlyTimeCostCents: Math.round(monthlyHours * p.hourValueCents),
    };
  });
  const wsum = workplaces.reduce((s, w) => s + w.weight * w.daysPerWeek, 0) || 1;
  const avg = workplaces.reduce((s, w) => s + ((w.ida.minutes + w.volta.minutes) / 2) * w.weight * w.daysPerWeek, 0) / wsum;
  const worst = workplaces.reduce((a, b) => (Math.max(b.ida.minutes, b.volta.minutes) > Math.max(a.ida.minutes, a.volta.minutes) ? b : a));
  const methods = new Set(workplaces.flatMap((w) => [w.ida.method, w.volta.method]));
  return {
    avgOneWayMin: Math.round(avg),
    worstOneWayMin: Math.max(worst.ida.minutes, worst.volta.minutes),
    worstName: worst.name,
    monthlyHours: Math.round(workplaces.reduce((s, w) => s + w.monthlyHours, 0) * 10) / 10,
    monthlyCostCents: workplaces.reduce((s, w) => s + w.monthlyCostCents, 0),
    monthlyTimeCostCents: workplaces.reduce((s, w) => s + w.monthlyTimeCostCents, 0),
    method: methods.size > 1 ? "misto" : ([...methods][0] as TripMethod),
    workplaces,
    computedAt: now.toISOString(),
  };
}

/**
 * Commute fraction for the grade (0–1): ≤ 15 min one way → 1; at the owner's limit → 0.5;
 * at twice the limit or more → 0. The worst trip pulls the result down (a long trip for one
 * person is a real cost even if the other works next door).
 */
export function commuteFraction(s: CommuteSummary, maxMin: number): number {
  const f = (m: number) => (m <= 15 ? 1 : m <= maxMin ? 1 - (0.5 * (m - 15)) / Math.max(1, maxMin - 15) : Math.max(0, 0.5 - (0.5 * (m - maxMin)) / maxMin));
  return Math.round((0.7 * f(s.avgOneWayMin) + 0.3 * f(s.worstOneWayMin)) * 1000) / 1000;
}

/** Strengths and points of attention about commuting, in pt-BR. */
export function commuteNotes(s: CommuteSummary, maxMin: number): { pros: string[]; cons: string[] } {
  const pros: string[] = [];
  const cons: string[] = [];
  for (const w of s.workplaces) {
    const worst = Math.max(w.ida.minutes, w.volta.minutes);
    const how = COMMUTE_MODE_LABEL[w.mode].toLowerCase();
    const text = `${w.name}: ${w.ida.minutes} min na ida (${w.ida.at}) e ${w.volta.minutes} min na volta (${w.volta.at}) de ${how}`;
    if (worst <= Math.min(25, maxMin * 0.6)) pros.push(`${text}.`);
    else if (worst > maxMin) cons.push(`${text}, acima do seu limite de ${maxMin} min.`);
  }
  if (s.monthlyHours >= 40) cons.push(`Cerca de ${Math.round(s.monthlyHours)} h por mês em deslocamento.`);
  return { pros, cons };
}

/** Next occurrence of a weekday in `days` at HH:MM in Belo Horizonte (UTC−3, no DST), as ISO. */
export function nextDepartAt(hhmm: string, days: number[], now = new Date()): string {
  const local = new Date(now.getTime() - 3 * 3_600_000);
  for (let add = 1; add <= 8; add++) {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + add));
    const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (days.includes(iso)) return `${d.toISOString().slice(0, 10)}T${hhmm}:00-03:00`;
  }
  return `${new Date(local.getTime() + 86_400_000).toISOString().slice(0, 10)}T${hhmm}:00-03:00`;
}

/** Whether the workplace's days are all on the weekend (uses the weekend curve). */
export const weekendOnly = (days: number[]) => days.every((d) => d >= 6);
