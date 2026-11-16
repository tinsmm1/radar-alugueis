import { describe, expect, it } from "vitest";
import { evaluate, gradeOf, placeScore, type EvalInput } from "./evaluation";
import type { LocationFacts } from "./risk";

const facts: LocationFacts = {
  precision: "exata",
  coverage: { sgb: true, osm: true, terrain: true, imported: false },
  flood: { insideClass: null, insideLevel: 0, nearHighM: null },
  landslide: { insideClass: null, insideLevel: 0, nearHighM: null },
  flashFlood: { inside: false },
  mapped: [],
  slopePct: 4,
  nearest: { metro: { distanceM: 400, name: "Central" }, supermercado: { distanceM: 200, name: null }, farmacia: { distanceM: 150, name: null }, parque: { distanceM: 300, name: null }, hospital: { distanceM: 900, name: null } },
  analyzedAt: "2026-11-13T00:00:00Z",
};

const good: EvalInput = {
  mode: "aluguel", priceVsMedianPct: 20, comparables: 12, comparableScope: "bairro", recentDropBp: 500, costComplete: true, yieldBp: null, facts,
  risk: { score: 0, level: "baixo", confidence: "normal", reasons: [] }, parking: 1, featureCount: 6, areaM2: 70, exactLocation: true, sources: 2,
};

describe("offer evaluation", () => {
  it("cheap, complete, safe and well served → A with reasons", () => {
    const e = evaluate(good);
    expect(e.score).toBe(100);
    expect(e.grade).toBe("A");
    expect(e.confidence).toBe("alta");
    expect(e.pros.join(" ")).toMatch(/20% abaixo da mediana de 12 imóveis parecidos no mesmo bairro/);
    expect(e.pros.join(" ")).toMatch(/Preço reduzido em 5%/);
    expect(e.cons).toEqual([]);
  });
  it("geographic risk is a separate note and never changes the grade", () => {
    const risky = evaluate({ ...good, risk: { score: 90, level: "alto", confidence: "normal", reasons: ["inundação: suscetibilidade alta"] } });
    expect(risky.score).toBe(evaluate(good).score);
    expect(risky.parts.map((p) => p.key)).not.toContain("risco");
    expect(risky.riskNote).toMatch(/Risco geográfico alto: inundação/);
    expect(risky.parts.reduce((s, p) => s + p.max, 0)).toBe(100);
  });
  it("expensive → low grade with points of attention", () => {
    const e = evaluate({ ...good, priceVsMedianPct: -25, recentDropBp: null, costComplete: false, risk: { score: 70, level: "alto", confidence: "normal", reasons: ["inundação: suscetibilidade alta"] }, parking: 0 });
    expect(["D", "E"]).toContain(e.grade);
    expect(e.cons.join(" ")).toMatch(/25% acima/);
    expect(e.cons.join(" ")).not.toMatch(/inundação/);
    expect(e.cons).toContain("Sem vaga de garagem.");
  });
  it("unknowns are neutral and lower the confidence, never good news", () => {
    const e = evaluate({ ...good, priceVsMedianPct: null, comparables: 0, comparableScope: null, recentDropBp: null, facts: null, risk: null, exactLocation: false, sources: 1 });
    expect(e.confidence).toBe("baixa");
    expect(e.parts.find((p) => p.key === "preco")!.points).toBe(25);
    expect(e.riskNote).toBeNull();
    expect(e.pros.some((p) => /risco/i.test(p))).toBe(false);
  });
  it("buy mode scores the yield instead of the running cost", () => {
    const high = evaluate({ ...good, mode: "compra", yieldBp: 650 });
    expect(high.parts.map((p) => p.key)).toContain("rendimento");
    expect(high.pros.join(" ")).toMatch(/Preço por m²/);
    expect(high.pros.join(" ")).toMatch(/Rendimento bruto estimado alto: 6,5%/);
    const low = evaluate({ ...good, mode: "compra", yieldBp: 300 });
    expect(low.score).toBeLessThan(high.score);
    expect(low.cons.join(" ")).toMatch(/baixo: 3%/);
  });
  it("grades by thresholds", () => {
    expect([80, 79, 65, 50, 35, 34].map(gradeOf)).toEqual(["A", "B", "B", "C", "D", "E"]);
  });
});

describe("place score", () => {
  it("no data at all → no grade", () => {
    expect(placeScore({ avgRisk: null, floodPct: null, nearestTransitM: null, transitStations: 0, supermarkets: 0, pharmacies: 0, hospitals: 0, parks: 0 }).grade).toBeNull();
  });
  it("well served beats far, regardless of geographic risk", () => {
    const a = placeScore({ avgRisk: 5, floodPct: 0, nearestTransitM: 300, transitStations: 3, supermarkets: 5, pharmacies: 6, hospitals: 2, parks: 3 });
    const b = placeScore({ avgRisk: 50, floodPct: 60, nearestTransitM: 4000, transitStations: 0, supermarkets: 0, pharmacies: 1, hospitals: 0, parks: 0 });
    expect(a.score!).toBeGreaterThan(b.score!);
    expect(a.grade).toBe("A");
    expect(b.cons.join(" ")).not.toMatch(/inundação/);
    const sameServicesRisky = placeScore({ avgRisk: 90, floodPct: 90, nearestTransitM: 300, transitStations: 3, supermarkets: 5, pharmacies: 6, hospitals: 2, parks: 3 });
    expect(sameServicesRisky.score).toBe(a.score);
  });
});
