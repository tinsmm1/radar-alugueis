import { describe, expect, it } from "vitest";
import { isCommercial } from "./apify";
import { actorInput, collectFiltersSchema, DEFAULT_COLLECT_FILTERS, describeFilters, isDefaultFilters, keepListing, readCollectFilters } from "./collect-filters";
import { EMPTY_LISTING, type NormalizedListing } from "./listing";

const listing = (over: Partial<NormalizedListing>): NormalizedListing => ({ ...EMPTY_LISTING, externalId: "1", type: "apartamento", purposes: ["aluguel"], rentCents: 250_000, ...over });
const noRegional = () => null;

describe("collect filters", () => {
  it("defaults to everything residential", () => {
    expect(isDefaultFilters(DEFAULT_COLLECT_FILTERS)).toBe(true);
    expect(readCollectFilters({ tipos: ["loja"] })).toEqual(DEFAULT_COLLECT_FILTERS);
    expect(actorInput(DEFAULT_COLLECT_FILTERS, "RENTAL")).toEqual({ unitTypes: ["APARTMENT", "HOME", "CONDOMINIUM"] });
    expect(describeFilters(DEFAULT_COLLECT_FILTERS)).toMatch(/Padrão/);
  });

  it("sends the price range of the task's business and the bedrooms to the robot", () => {
    const f = collectFiltersSchema.parse({ tipos: ["apartamento"], aluguelMin: 1500, aluguelMax: 3000, vendaMax: 800_000, quartosMin: 2 });
    expect(actorInput(f, "RENTAL")).toEqual({ unitTypes: ["APARTMENT"], minPrice: 1500, maxPrice: 3000, minBedrooms: 2 });
    expect(actorInput(f, "SALE")).toEqual({ unitTypes: ["APARTMENT"], maxPrice: 800_000, minBedrooms: 2 });
  });

  it("checks type, price, bedrooms and regional on import; unknown values never exclude", () => {
    const f = collectFiltersSchema.parse({ tipos: ["apartamento"], aluguelMax: 3000, quartosMin: 2, regionais: ["Centro-Sul"] });
    const regionalOf = (b: string) => (b === "savassi" ? "Centro-Sul" : b === "castelo" ? "Pampulha" : null);
    expect(keepListing(listing({ bedrooms: 3, neighborhood: "Savassi" }), f, regionalOf)).toBe(true);
    expect(keepListing(listing({ type: "casa" }), f, noRegional)).toBe(false);
    expect(keepListing(listing({ rentCents: 400_000 }), f, noRegional)).toBe(false);
    expect(keepListing(listing({ bedrooms: 1 }), f, noRegional)).toBe(false);
    expect(keepListing(listing({ neighborhood: "Castelo" }), f, regionalOf)).toBe(false);
    expect(keepListing(listing({ bedrooms: null, neighborhood: "Desconhecido" }), f, regionalOf)).toBe(true);
  });

  it("recognises commercial property", () => {
    expect(isCommercial("COMMERCIAL", "APARTMENT", null)).toBe(true);
    expect(isCommercial(null, "COMMERCIAL_PROPERTY", null)).toBe(true);
    expect(isCommercial(null, "OFFICE", null)).toBe(true);
    expect(isCommercial(null, null, "Sala comercial com 30 m² no Centro")).toBe(true);
    expect(isCommercial("RESIDENTIAL", "APARTMENT", "Apartamento perto de loja")).toBe(false);
    expect(isCommercial(null, "HOME", "Casa com 3 quartos")).toBe(false);
  });
});
