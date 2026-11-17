import { describe, expect, it } from "vitest";
import { buyAffordability, maxPriceFor, rentAffordability } from "./affordability";
import { DEFAULT_PROFILE } from "./profile";

describe("affordability", () => {
  const p = { ...DEFAULT_PROFILE, monthlyIncomeCents: 2_000_000, savingsCents: 15_000_000 }; // R$ 20 mil, R$ 150 mil
  it("max price is limited by income or savings and the max price itself fits", () => {
    const m = maxPriceFor(p);
    expect(m.cents).not.toBeNull();
    const a = buyAffordability(Math.floor(m.cents! * 0.99), null, null, p);
    expect(["cabe", "apertado"]).toContain(a.fit);
  });
  it("too expensive does not fit and explains why", () => {
    const a = buyAffordability(300_000_000, 100_000, 30_000, p);
    expect(a.fit).toBe("nao_cabe");
    expect(a.reasons.join(" ")).toMatch(/reserva não cobre/);
  });
  it("without income and savings → asks for data", () => {
    expect(buyAffordability(50_000_000, null, null, DEFAULT_PROFILE).fit).toBe("sem_dados");
  });
  it("rent against income", () => {
    expect(rentAffordability(500_000, 40_000, p).fit).toBe("cabe");
    expect(rentAffordability(900_000, null, p).fit).toBe("nao_cabe");
  });
});
