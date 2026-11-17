import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, newWorkplaceId, normalisedWeights, parseProfile, workplaceSignature } from "./profile";

describe("profile", () => {
  it("empty or broken JSON falls back to defaults", () => {
    expect(parseProfile(null)).toEqual(DEFAULT_PROFILE);
    expect(parseProfile({ maxCommuteMin: "x" })).toEqual(DEFAULT_PROFILE);
    expect(parseProfile({ maxCommuteMin: 30, workplaces: [{ bad: true }] }).maxCommuteMin).toBe(30);
  });
  it("weights sum 100 and drop commute without workplaces", () => {
    const w = normalisedWeights(DEFAULT_PROFILE, false);
    expect(w.deslocamento).toBe(0);
    expect(Math.round(Object.values(w).reduce((s, x) => s + x, 0))).toBe(100);
  });
  it("ids are slugs and signatures change with times", () => {
    expect(newWorkplaceId("Escritório Centro", 0.5)).toMatch(/^escritorio-centro-[a-z0-9]{4,}$/);
    const w = { id: "a-001", name: "A", address: "x", lat: -19.9, lng: -43.9, mode: "carro" as const, departure: "08:00", returnAt: "18:00", days: [1], weight: 5 };
    expect(workplaceSignature(w)).not.toBe(workplaceSignature({ ...w, departure: "07:30" }));
  });
});
