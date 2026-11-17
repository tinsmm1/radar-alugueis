import { describe, expect, it } from "vitest";
import { comparableReliability, drivers, evaluate, gradeOf, placeScore, type EvalInput } from "./evaluation";
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

describe("evaluation with the owner's profile", () => {
  const commute = (m: number) => ({ avgOneWayMin: m, worstOneWayMin: m, worstName: "Trabalho", monthlyHours: (m * 2 * 22) / 60, monthlyCostCents: 0, monthlyTimeCostCents: 0, method: "modelo" as const, workplaces: [], computedAt: "" });
  it("adds a commute part, keeps 100 points and prefers the closer home", () => {
    const near = evaluate({ ...good, commute: commute(12), maxCommuteMin: 45 });
    const far = evaluate({ ...good, commute: commute(80), maxCommuteMin: 45 });
    expect(near.parts.map((p) => p.key)).toContain("deslocamento");
    expect(near.parts.reduce((s, p) => s + p.max, 0)).toBe(100);
    expect(near.score).toBeGreaterThan(far.score);
    expect(near.commute?.avgOneWayMin).toBe(12);
  });
  it("custom weights are respected", () => {
    const e = evaluate({ ...good, commute: commute(30), weights: { preco: 20, custos: 10, deslocamento: 50, servicos: 10, imovel: 10 } });
    expect(e.parts.find((p) => p.key === "deslocamento")!.max).toBe(50);
  });
});

describe("score robustness (audit 2026-11)", () => {
  it("few comparables shrink the price effect and say so", () => {
    expect(comparableReliability(5, "bairro")).toBe(0.75);
    expect(comparableReliability(12, "bairro")).toBe(1);
    expect(comparableReliability(12, "regional")).toBe(0.85);
    const few = evaluate({ ...good, comparables: 5, recentDropBp: null });
    const many = evaluate({ ...good, comparables: 12, recentDropBp: null });
    expect(few.parts[0].points).toBeLessThan(many.parts[0].points);
    expect(few.cons.join(" ")).toMatch(/poucos imóveis \(5\)/);
  });
  it("a price far below the comparables is flagged, capped and lowers confidence", () => {
    const e = evaluate({ ...good, priceVsMedianPct: 45, recentDropBp: null });
    expect(e.parts[0].points).toBeLessThanOrEqual(40);
    expect(e.cons.join(" ")).toMatch(/golpe/);
    expect(e.confidence).not.toBe("alta");
  });
  it("profile with workplaces but no commute for this home: neutral part, lower confidence", () => {
    const w = { preco: 40, custos: 12, deslocamento: 20, servicos: 18, imovel: 10 };
    const e = evaluate({ ...good, weights: w, expectCommute: true, commute: null });
    const part = e.parts.find((p) => p.key === "deslocamento")!;
    expect(part.points).toBe(10);
    expect(e.confidence).toBe("media");
  });
  it("expensive condo is a point of attention and lowers the buy yield part", () => {
    const base = evaluate({ ...good, mode: "compra", yieldBp: 500 });
    const pricey = evaluate({ ...good, mode: "compra", yieldBp: 500, condoVsMedianPct: -40 });
    expect(pricey.score).toBeLessThan(base.score);
    expect(pricey.cons.join(" ")).toMatch(/Condomínio por m² 40% acima/);
  });
  it("drivers name the parts that pulled the grade up and down", () => {
    const e = evaluate({ ...good, priceVsMedianPct: -25, recentDropBp: null });
    expect(drivers(e).down.map((p) => p.key)).toContain("preco");
    expect(drivers(evaluate(good)).up.map((p) => p.key)).toContain("preco");
  });
});
