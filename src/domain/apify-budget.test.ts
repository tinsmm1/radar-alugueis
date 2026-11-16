import { describe, expect, it } from "vitest";
import { actorPricing, planRun, type PlanInput } from "./apify-budget";

const perItem = actorPricing([{ pricingModel: "PAY_PER_EVENT", startedAt: "2026-01-01", pricingPerEvent: { actorChargeEvents: { "apify-actor-start": { eventPriceUsd: 0.005 }, result: { eventPriceUsd: 0.002 } } } }]);
const base: PlanInput = { pricing: perItem, usedUsd: 0, accountLimitUsd: 5, now: new Date("2026-12-01T09:00:00Z"), cycleEnd: new Date("2027-01-01T09:00:00Z"), activeTasks: 1 };

describe("actorPricing", () => {
  it("reads pay-per-result, pay-per-event (start fee) and the latest entry", () => {
    expect(perItem).toEqual({ model: "per_item", perItemUsd: 0.002, startFeeUsd: 0.005 });
    expect(actorPricing([{ pricingModel: "FLAT_PRICE_PER_MONTH", startedAt: "2025-01-01" }, { pricingModel: "PRICE_PER_DATASET_ITEM", startedAt: "2026-01-01", pricePerUnitUsd: 0.0016 }])).toEqual({ model: "per_item", perItemUsd: 0.0016, startFeeUsd: 0 });
    expect(actorPricing([{ pricingModel: "PRICE_PER_DATASET_ITEM", tieredPricing: { FREE: { tieredPricePerUnitUsd: 0.003 }, GOLD: { tieredPricePerUnitUsd: 0.001 } } }])).toMatchObject({ perItemUsd: 0.003 });
    expect(actorPricing([{ pricingModel: "FLAT_PRICE_PER_MONTH" }])).toEqual({ model: "monthly" });
    expect(actorPricing(undefined)).toEqual({ model: "usage" });
  });
});

describe("planRun", () => {
  it("spreads the free credit over the 31 days of the cycle (1 task: 70 results, US$ 0.14)", () => {
    const plan = planRun(base);
    expect(plan).toMatchObject({ run: true, maxItems: 70, maxChargeUsd: 0.14, runsLeft: 31 });
  });

  it("shares the credit between rent and sale tasks", () => {
    expect(planRun({ ...base, activeTasks: 2 })).toMatchObject({ run: true, maxItems: 33, runsLeft: 62 });
  });

  it("adapts to what was already spent and to the days left", () => {
    // 10 days left with US$ 3.50 spent: (4.50 - 3.50) / 10 = US$ 0.10 per run.
    const plan = planRun({ ...base, usedUsd: 3.5, now: new Date("2026-12-22T09:00:00Z") });
    expect(plan).toMatchObject({ run: true, maxItems: 47, maxChargeUsd: 0.1, runsLeft: 10 });
  });

  it("never plans above US$ 5, even on a paid account", () => {
    expect(planRun({ ...base, accountLimitUsd: 100 })).toMatchObject({ maxItems: 70 });
  });

  it("stops when the month's credit is used, and refuses monthly-fee actors", () => {
    expect(planRun({ ...base, usedUsd: 4.6 })).toMatchObject({ run: false });
    expect(planRun({ ...base, pricing: { model: "monthly" } })).toMatchObject({ run: false });
  });

  it("bounds usage-priced actors by timeout", () => {
    expect(planRun({ ...base, pricing: { model: "usage" } })).toMatchObject({ run: true, timeoutSecs: 1306, memoryMbytes: 1024 });
  });
});
