import { describe, expect, it } from "vitest";
import { parseCoordinate, parseCoordinatePair } from "./geo";

describe("parseCoordinate", () => {
  it("reads decimal and degree formats", () => {
    expect(parseCoordinate("-19.9836")).toBe(-19.9836);
    expect(parseCoordinate("-19,9836")).toBe(-19.9836);
    expect(parseCoordinate(`19°59'00.8"S`)).toBeCloseTo(-19.983556, 5);
    expect(parseCoordinate(`43°56'46.2"W`)).toBeCloseTo(-43.946167, 5);
    expect(parseCoordinate("43°56'46.2\"O")).toBeCloseTo(-43.946167, 5);
    expect(parseCoordinate("abc")).toBeNull();
    expect(parseCoordinate("")).toBeNull();
  });
  it("splits a pasted pair", () => {
    expect(parseCoordinatePair("-19.98356, -43.94617")).toEqual({ lat: -19.98356, lng: -43.94617 });
    const p = parseCoordinatePair(`19°59'00.8"S 43°56'46.2"W`)!;
    expect(p.lat).toBeCloseTo(-19.983556, 5);
    expect(p.lng).toBeCloseTo(-43.946167, 5);
  });
});
