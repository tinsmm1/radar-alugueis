import { describe, expect, it } from "vitest";
import { commuteFraction, commuteNotes, congestionFactor, modelTrip, nextDepartAt, summarise, tripCostsCents } from "./commute";
import { DEFAULT_PROFILE, type Workplace } from "./profile";

const home = { lat: -19.9386, lng: -43.9386 }; // Savassi area
const office = { lat: -19.8665, lng: -43.9586 }; // Pampulha area (~8 km)
const wp: Workplace = { id: "trabalho-0001", name: "Trabalho", address: "Av. Antônio Carlos", lat: office.lat, lng: office.lng, mode: "carro", departure: "08:00", returnAt: "18:00", days: [1, 2, 3, 4, 5], weight: 5 };

describe("commute model", () => {
  it("rush hour is about 1.9× free flow and the night is near free flow", () => {
    expect(congestionFactor("08:30")).toBeGreaterThan(1.85);
    expect(congestionFactor("18:30")).toBeGreaterThan(1.85);
    expect(congestionFactor("03:30")).toBeLessThan(1.1);
    expect(congestionFactor("08:30", true)).toBeLessThan(1.3);
  });
  it("car at 08:00 is slower than at 11:00; bus at peak is slower than car", () => {
    const peak = modelTrip(home, office, "carro", "08:00", "ida");
    const mid = modelTrip(home, office, "carro", "11:00", "ida");
    const bus = modelTrip(home, office, "onibus", "08:00", "ida");
    expect(peak.minutes).toBeGreaterThan(mid.minutes);
    expect(bus.minutes).toBeGreaterThan(peak.minutes);
    expect(peak.method).toBe("modelo");
    expect(peak.minMinutes).toBeLessThan(peak.minutes);
    expect(peak.maxMinutes).toBeGreaterThan(peak.minutes);
    // ~8 km straight × 1.35 ≈ 11 km at ~17 km/h + 4 min ≈ 40–45 min
    expect(peak.minutes).toBeGreaterThan(30);
    expect(peak.minutes).toBeLessThan(55);
  });
  it("summary weights workplaces and computes monthly hours and money", () => {
    const ida = modelTrip(home, office, "carro", "08:00", "ida");
    const volta = modelTrip(office, home, "carro", "18:00", "volta");
    const s = summarise(DEFAULT_PROFILE, [{ workplace: wp, ida, volta }])!;
    expect(s.avgOneWayMin).toBe(Math.round((ida.minutes + volta.minutes) / 2));
    expect(s.monthlyHours).toBeGreaterThan(20);
    expect(s.monthlyCostCents).toBe(tripCostsCents(DEFAULT_PROFILE, wp, ida, volta));
    expect(s.monthlyTimeCostCents).toBeGreaterThan(0);
  });
  it("fraction: short is 1, at the limit about 0.5, far is 0", () => {
    const mk = (m: number) => ({ avgOneWayMin: m, worstOneWayMin: m, worstName: "x", monthlyHours: 0, monthlyCostCents: 0, monthlyTimeCostCents: 0, method: "modelo" as const, workplaces: [], computedAt: "" });
    expect(commuteFraction(mk(10), 45)).toBe(1);
    expect(commuteFraction(mk(45), 45)).toBe(0.5);
    expect(commuteFraction(mk(95), 45)).toBe(0);
  });
  it("notes flag trips above the limit", () => {
    const ida = { ...modelTrip(home, office, "carro", "08:00", "ida"), minutes: 70 };
    const volta = { ...modelTrip(office, home, "carro", "18:00", "volta"), minutes: 75 };
    const s = summarise(DEFAULT_PROFILE, [{ workplace: wp, ida, volta }])!;
    expect(commuteNotes(s, 45).cons.join(" ")).toMatch(/acima do seu limite de 45 min/);
  });
  it("next departure is a future working day at the local time", () => {
    const iso = nextDepartAt("08:00", [1, 2, 3, 4, 5], new Date("2026-11-20T15:00:00Z")); // Friday
    expect(iso).toBe("2026-11-23T08:00:00-03:00"); // Monday
  });
});
