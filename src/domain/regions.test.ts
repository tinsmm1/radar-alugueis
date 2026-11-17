import { describe, expect, it } from "vitest";
import { compareRegions, type RegionRow } from "./regions";

const rows = (area: string, price: number, commute: number | null, n = 4, evalScore = 60): RegionRow[] =>
  Array.from({ length: n }, () => ({ area, priceM2Cents: price, yieldBp: 500, commuteMin: commute, evalScore, inFloodArea: false, riskHigh: false }));

describe("region comparison", () => {
  it("frontier keeps areas no other beats on price and commute at once", () => {
    const s = compareRegions([...rows("Barato e longe", 500_000, 60), ...rows("Caro e perto", 1_200_000, 15), ...rows("Caro e longe", 1_300_000, 65), ...rows("Meio", 800_000, 30)], { maxCommuteMin: 45, mode: "compra" });
    const by = Object.fromEntries(s.map((x) => [x.area, x]));
    expect(by["Barato e longe"].frontier).toBe(true);
    expect(by["Caro e perto"].frontier).toBe(true);
    expect(by["Meio"].frontier).toBe(true);
    expect(by["Caro e longe"].frontier).toBe(false);
    expect(by["Caro e longe"].score!).toBeLessThan(by["Meio"].score!);
  });
  it("small samples get no grade", () => {
    const s = compareRegions(rows("Pequeno", 500_000, 20, 2), { maxCommuteMin: 45, mode: "aluguel" });
    expect(s[0].grade).toBeNull();
  });
  it("risk is shown but never changes the score", () => {
    const safe = compareRegions([...rows("A", 500_000, 20), ...rows("B", 900_000, 30)], { maxCommuteMin: 45, mode: "aluguel" });
    const risky = compareRegions([...rows("A", 500_000, 20).map((r) => ({ ...r, inFloodArea: true })), ...rows("B", 900_000, 30)], { maxCommuteMin: 45, mode: "aluguel" });
    expect(risky.find((x) => x.area === "A")!.score).toBe(safe.find((x) => x.area === "A")!.score);
    expect(risky.find((x) => x.area === "A")!.floodPct).toBe(100);
  });
});
