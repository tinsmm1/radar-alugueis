import { describe, expect, it } from "vitest";
import { apifyTaskId, parseApifyItems } from "./apify";

const glue = {
  listing: {
    id: "2712345678",
    title: "Apartamento com 3 quartos para alugar, 90 m² - Savassi",
    description: "Lindo apartamento com varanda e elevador. Ligue (31) 99999-0000",
    unitTypes: ["APARTMENT"],
    usableAreas: ["90"],
    bedrooms: [3],
    suites: [1],
    bathrooms: [2],
    parkingSpaces: [2],
    amenities: ["POOL", "GYM"],
    pricingInfos: [
      { businessType: "RENTAL", price: "3500", monthlyCondoFee: "800", yearlyIptu: "1200" },
      { businessType: "SALE", price: "950000" },
    ],
    address: { city: "Belo Horizonte", neighborhood: "Savassi", street: "Rua Pernambuco", point: { lat: -19.935, lon: -43.935 } },
    phones: ["31999990000"],
  },
  medias: [{ url: "https://resizedimgs.zapimoveis.com.br/{action}/{width}x{height}/foto.jpg" }],
  link: { href: "https://www.zapimoveis.com.br/imovel/2712345678/" },
  account: { name: "Imobiliária Exemplo" },
};

describe("parseApifyItems", () => {
  it("reads the ZAP/Viva Real glue shape (rent and sale)", () => {
    const { listings, raws } = parseApifyItems([glue]);
    expect(listings).toHaveLength(1);
    const l = listings[0];
    expect(l.purposes).toEqual(["aluguel", "compra"]);
    expect(l.rentCents).toBe(350_000);
    expect(l.salePriceCents).toBe(95_000_000);
    expect(l.condoCents).toBe(80_000);
    expect(l).toMatchObject({ iptuCents: 120_000, iptuPeriod: "anual", areaM2: 90, bedrooms: 3, parking: 2, neighborhood: "Savassi", lat: -19.935, lng: -43.935 });
    expect(l.features).toEqual(expect.arrayContaining(["varanda", "elevador", "suite", "piscina", "academia"]));
    expect(l.photos[0]).toBe("https://resizedimgs.zapimoveis.com.br/crop/870x653/foto.jpg");
    expect(l.description).not.toContain("99999");
    expect(JSON.stringify(raws)).not.toContain("31999990000");
  });

  it("reads flat shapes and guesses the deal from the price", () => {
    const { listings } = parseApifyItems([
      { id: 1, url: "https://www.olx.com.br/x", title: "Casa 2 quartos", price: "R$ 1.800", neighborhood: "Padre Eustáquio", city: "Belo Horizonte", area: "70 m²" },
      { id: 2, title: "Apartamento", price: 450000, transactionType: "venda", bairro: "Buritis" },
    ]);
    expect(listings.map((l) => [l.purposes, l.rentCents, l.salePriceCents])).toEqual([
      [["aluguel"], 180_000, null],
      [["compra"], null, 45_000_000],
    ]);
    expect(listings[0].type).toBe("casa");
  });

  it("skips listings without price or outside BH", () => {
    const { listings, skipped } = parseApifyItems([{ id: "a", title: "x" }, { id: "b", price: 2000, city: "Contagem" }]);
    expect(listings).toHaveLength(0);
    expect(skipped).toEqual({ "sem preço": 1, "fora de Belo Horizonte": 1 });
  });
});

describe("apifyTaskId", () => {
  it("accepts ids and links", () => {
    expect(apifyTaskId("joao~zap-bh")).toBe("joao~zap-bh");
    expect(apifyTaskId("https://console.apify.com/actors/tasks/AbC123xyz/input")).toBe("AbC123xyz");
    expect(apifyTaskId("../../etc")).toBeNull();
  });
});
