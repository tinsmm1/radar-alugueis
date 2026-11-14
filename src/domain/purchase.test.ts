import { describe, expect, it } from "vitest";
import { acquisition, buyVsRent, DEFAULT_ASSUMPTIONS, finance, grossYieldBp, monthlyRate, ownershipMonthly, pricePerM2 } from "./purchase";

const R = (reais: number) => reais * 100;

describe("financing", () => {
  it("monthly rate from an effective annual rate", () => {
    expect(monthlyRate(12.6825)).toBeCloseTo(0.01, 6);
    expect(monthlyRate(0)).toBe(0);
  });

  it("Price: constant payment from the annuity formula", () => {
    // R$ 100.000, 1% a.m. (12,6825% a.a.), 12 meses → R$ 8.884,88.
    const f = finance(R(100_000), 12.6825, 1, "price");
    expect(f.firstPaymentCents).toBe(f.lastPaymentCents);
    expect(f.firstPaymentCents).toBeGreaterThan(888_480);
    expect(f.firstPaymentCents).toBeLessThan(888_496);
    expect(f.totalPaidCents - f.financedCents).toBe(f.totalInterestCents);
  });

  it("SAC: decreasing payments; first = amortization + interest on the full balance", () => {
    const f = finance(R(120_000), 12.6825, 1, "sac");
    expect(f.firstPaymentCents).toBe(R(10_000) + R(1_200));
    expect(f.lastPaymentCents).toBe(R(10_000) + R(100));
    // Interest: 1% × 10.000 × (12+11+…+1) = 7.800.
    expect(f.totalInterestCents).toBe(R(7_800));
  });

  it("SAC pays less interest than Price for the same loan", () => {
    const sac = finance(R(400_000), 11, 30, "sac");
    const price = finance(R(400_000), 11, 30, "price");
    expect(sac.totalInterestCents).toBeLessThan(price.totalInterestCents);
    expect(sac.firstPaymentCents).toBeGreaterThan(price.firstPaymentCents);
  });

  it("zero-interest and empty loans", () => {
    expect(finance(R(12_000), 0, 1, "price").firstPaymentCents).toBe(R(1_000));
    expect(finance(0, 11, 30, "sac").totalPaidCents).toBe(0);
  });
});

describe("costs, buy vs rent and yield", () => {
  it("acquisition: down payment + ITBI (3%) + registry", () => {
    expect(acquisition(R(500_000), DEFAULT_ASSUMPTIONS)).toEqual({ downCents: R(100_000), itbiCents: R(15_000), registryCents: R(7_500), upfrontCents: R(122_500) });
  });

  it("ownership monthly keeps unknown condo/IPTU as partial, never zero", () => {
    const o = ownershipMonthly(R(480_000), null, R(150), DEFAULT_ASSUMPTIONS);
    expect(o).toMatchObject({ partial: true, upkeepCents: R(200), knownCents: R(350) });
  });

  it("buy vs rent with an estimated rent", () => {
    const b = buyVsRent(R(500_000), R(600), R(200), R(2_500), DEFAULT_ASSUMPTIONS);
    expect(b.rentMonthlyCents).toBe(R(3_300));
    expect(b.buyMonthlyCents).toBeGreaterThan(b.rentMonthlyCents!);
    expect(b.priceToRentYears).toBe(16.7);
    expect(b.opportunityCostCents).toBeGreaterThan(0);
    expect(buyVsRent(R(500_000), null, null, null, DEFAULT_ASSUMPTIONS)).toMatchObject({ rentMonthlyCents: null, differenceCents: null, priceToRentYears: null });
  });

  it("gross yield and price per m²", () => {
    expect(grossYieldBp(R(2_500), R(500_000))).toBe(600);
    expect(grossYieldBp(null, R(500_000))).toBeNull();
    expect(pricePerM2(R(500_000), 80)).toBe(R(6_250));
  });
});
