import { describe, expect, it } from "vitest";
import { negotiation } from "./negotiation";

describe("negotiation plan", () => {
  const base = { mode: "compra" as const, askingCents: 50_000_000, priceVsMedianPct: 0, daysOnMarket: 20, totalDropBp: null, sources: 1 };
  it("aligned price: usual margin, opening below target below asking", () => {
    const n = negotiation(base)!;
    expect(n.discountPct).toBe(4);
    expect(n.openingCents).toBeLessThan(n.targetCents);
    expect(n.targetCents).toBeLessThan(50_000_000);
    expect(n.leverage).toBe("baixa");
  });
  it("expensive and stale: high leverage, bigger discount, ceiling at fair value", () => {
    const n = negotiation({ ...base, priceVsMedianPct: -15, daysOnMarket: 150, totalDropBp: 300 })!;
    expect(n.leverage).toBe("alta");
    expect(n.discountPct).toBeGreaterThan(10);
    expect(n.urgency).toBe("sem_pressa");
    expect(n.ceilingCents).toBeLessThan(50_000_000);
  });
  it("already cheap: decide fast, small discount", () => {
    const n = negotiation({ ...base, priceVsMedianPct: 18 })!;
    expect(n.urgency).toBe("decidir_rapido");
    expect(n.discountPct).toBe(1);
    expect(n.ceilingCents).toBe(50_000_000);
  });
  it("no price → no plan", () => {
    expect(negotiation({ ...base, askingCents: null })).toBeNull();
  });
});
