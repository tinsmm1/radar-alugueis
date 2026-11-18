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

import { groupDigits, parseBrNumber } from "./money";
describe("pt-BR number fields", () => {
  it("groups thousands while typing and parses back", () => {
    expect(groupDigits("200000")).toBe("200.000");
    expect(groupDigits("1234,5")).toBe("1.234,5");
    expect(groupDigits("R$ 2.500")).toBe("2.500");
    expect(groupDigits("")).toBe("");
    expect(parseBrNumber("200.000")).toBe(200000);
    expect(parseBrNumber("1.234,56")).toBe(1234.56);
    expect(parseBrNumber("")).toBeNull();
  });
});

import { detectFeatures } from "./listing";
describe("EV charging detection", () => {
  it("finds an installed charger and prepared infrastructure, not negations", () => {
    expect(detectFeatures("Vaga com carregador para carro elétrico")).toContain("carregador_eletrico");
    expect(detectFeatures("Garagem com wallbox")).toContain("carregador_eletrico");
    expect(detectFeatures("ELECTRIC CAR CHARGER")).toContain("carregador_eletrico");
    expect(detectFeatures("Prédio com infraestrutura para carregador de veículos elétricos")).toContain("preparo_carregador");
    expect(detectFeatures("Sem carregador elétrico")).not.toContain("carregador_eletrico");
    expect(detectFeatures("Apartamento com 2 quartos e varanda")).not.toContain("carregador_eletrico");
  });
});
