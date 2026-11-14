import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { costPerM2, iptuPerMonth, monthlyCost } from "./cost";
import { parseCsvRows, parseListingsCsv, CSV_TEMPLATE } from "./csv";
import { detectFeatures, normalizeType } from "./listing";
import { brl, meters, parseArea, parseCount, parseMoney } from "./money";
import { normalizeText, textSimilarity, titleCase } from "./text";
import { parseVrsync, safeUrl } from "./vrsync";

describe("money and parsing", () => {
  it.each([
    ["R$ 2.500,00", 250_000],
    ["2500", 250_000],
    ["2.500", 250_000],
    ["2500.50", 250_050],
    ["2,500.00", 250_000],
    ["780,50", 78_050],
    ["1,5 mil", 150_000],
    [3500, 350_000],
    ["consulte", null],
    ["", null],
    ["-", null],
    [-5, null],
  ])("parseMoney(%j) = %j", (input, cents) => expect(parseMoney(input)).toBe(cents));

  it("areas and counts", () => {
    expect(parseArea("75,5 m²")).toBe(75.5);
    expect(parseArea("1.200")).toBe(1200);
    expect(parseArea("2")).toBeNull();
    expect(parseCount("3 quartos")).toBe(3);
    expect(parseCount("99")).toBeNull();
  });

  it("formats", () => {
    expect(brl(350_000)).toBe("R$ 3.500");
    expect(brl(null)).toBe("—");
    expect(meters(184)).toBe("180 m");
    expect(meters(1250)).toBe("1,3 km");
  });

  it("text helpers", () => {
    expect(normalizeText("  São  Pedro! ")).toBe("sao pedro");
    expect(titleCase("BAIRRO DAS INDÚSTRIAS")).toBe("Bairro das Indústrias");
    expect(textSimilarity("Apartamento 3 quartos Savassi varanda", "3 quartos na Savassi com varanda")).toBeGreaterThan(0.5);
    expect(textSimilarity("", "x")).toBe(0);
  });
});

describe("features and types", () => {
  it("detects features with synonyms and English tags", () => {
    expect(detectFeatures("Prédio com elevador, portaria 24 horas, piscina", "Gym · BBQ")).toEqual(["elevador", "piscina", "academia", "portaria_24h", "churrasqueira"]);
  });
  it("ignores negations", () => {
    expect(detectFeatures("Não aceita animais. Sem elevador. Não é mobiliado")).toEqual([]);
    expect(detectFeatures("Aceita animais, mobiliado")).toEqual(["mobiliado", "aceita_animais"]);
  });
  it("normalizes types", () => {
    expect(normalizeType("Cobertura duplex")).toBe("cobertura");
    expect(normalizeType("Casa em condomínio")).toBe("casa_condominio");
    expect(normalizeType("Studio mobiliado")).toBe("kitnet");
    expect(normalizeType("Apto 2 qts")).toBe("apartamento");
    expect(normalizeType("Galpão")).toBeNull();
  });
});

describe("monthly cost", () => {
  it("complete: rent + condo + annual IPTU / 12 + fees", () => {
    const c = monthlyCost({ rentCents: 350_000, condoCents: 78_050, iptuCents: 240_000, iptuPeriod: "anual", otherFeesCents: 5_000 });
    expect(c.iptuMonthlyCents).toBe(20_000);
    expect(c.totalKnownCents).toBe(350_000 + 78_050 + 20_000 + 5_000);
    expect(c.status).toBe("completo");
    expect(c.missing).toEqual([]);
  });
  it("never treats unknown values as zero: partial and lists what is missing", () => {
    const c = monthlyCost({ rentCents: 200_000, condoCents: null, iptuCents: null, iptuPeriod: null, otherFeesCents: null });
    expect(c.status).toBe("parcial");
    expect(c.missing).toEqual(["condomínio", "IPTU"]);
    expect(c.totalKnownCents).toBe(200_000);
  });
  it("zero condo (exempt) is known, not missing", () => {
    expect(monthlyCost({ rentCents: 200_000, condoCents: 0, iptuCents: 10_000, iptuPeriod: "mensal", otherFeesCents: null }).status).toBe("completo");
  });
  it("unknown rent → unknown cost", () => {
    const c = monthlyCost({ rentCents: null, condoCents: 50_000, iptuCents: null, iptuPeriod: null, otherFeesCents: null });
    expect(c.totalKnownCents).toBeNull();
    expect(c.status).toBe("desconhecido");
  });
  it("guesses an annual IPTU when the period is missing and the value is large", () => {
    expect(iptuPerMonth(240_000, null, 200_000)).toBe(20_000);
    expect(iptuPerMonth(15_000, null, 200_000)).toBe(15_000);
  });
  it("cost per m²", () => {
    expect(costPerM2(400_000, 80)).toBe(5_000);
    expect(costPerM2(null, 80)).toBeNull();
    expect(costPerM2(400_000, null)).toBeNull();
  });
});

describe("VRSync feed", () => {
  const xml = readFileSync(new URL("./__fixtures__/feed-vrsync.xml", import.meta.url), "utf8");
  const res = parseVrsync(xml);

  it("keeps rentals and sales in Belo Horizonte with their purposes, and reports what was skipped", () => {
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.provider).toBe("Imobiliária Exemplo de Teste");
    expect(res.listings.map((l) => [l.externalId, l.purposes])).toEqual([["AP-101", ["aluguel"]], ["CA-7", ["aluguel", "compra"]], ["V-1", ["compra"]]]);
    expect(res.listings[1]).toMatchObject({ rentCents: 420_000, salePriceCents: 90_000_000 });
    expect(res.listings[2]).toMatchObject({ rentCents: null, salePriceCents: 50_000_000 });
    expect(res.skipped).toEqual({ "fora de Belo Horizonte": 1, "sem ListingID": 1 });
  });

  it("normalizes a full listing", () => {
    if (!res.ok) throw new Error("parse failed");
    const ap = res.listings[0];
    expect(ap).toMatchObject({
      type: "apartamento", rentCents: 350_000, condoCents: 78_050, iptuCents: 240_000, iptuPeriod: "anual", areaM2: 92, bedrooms: 3, suites: 1, bathrooms: 2, parking: 2,
      neighborhood: "Savassi", street: "Rua Pernambuco", number: "1000", postalCode: "30130151", lat: -19.9367, addressHidden: false, advertiserType: "imobiliaria",
    });
    expect(ap.photos[0]).toBe("https://example.com/fotos/ap101-1.jpg");
    expect(ap.photos).toHaveLength(2);
    expect(ap.features).toEqual(expect.arrayContaining(["varanda", "elevador", "piscina", "academia", "portaria_24h", "aceita_animais", "suite", "churrasqueira"]));
    expect(ap.features).not.toContain("mobiliado");
    expect(JSON.stringify(ap)).not.toContain("99999");
    expect(JSON.stringify(res.raws["AP-101"])).not.toContain("99999");
    expect(JSON.stringify(res.raws["AP-101"])).not.toContain("corretor@");
    expect(JSON.stringify(res.raws["AP-101"])).toContain("Imobiliária Exemplo de Teste");
  });

  it("respects a hidden address and the Sale/Rent rental price", () => {
    if (!res.ok) throw new Error("parse failed");
    const ca = res.listings[1];
    expect(ca).toMatchObject({ type: "casa_condominio", rentCents: 420_000, iptuPeriod: "anual", street: null, number: null, addressHidden: true });
    expect(ca.features).toContain("condominio_fechado");
  });

  it("rejects files that are not feeds and unsafe links", () => {
    expect(parseVrsync("<html><body>login</body></html>").ok).toBe(false);
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("/relativo")).toBeNull();
  });
});

describe("CSV template", () => {
  it("parses quotes, separators and line endings", () => {
    expect(parseCsvRows('a;b\r\n"x;1";"he said ""oi"""\n')).toEqual([["a", "b"], ["x;1", 'he said "oi"']]);
    expect(parseCsvRows("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("imports sales and both-purpose rows", () => {
    const head = "id;aluguel;preco_venda;finalidade;bairro\n";
    const res = parseListingsCsv(head + "a;;450.000;venda;Centro\nb;2.000;380000;ambos;Prado\nc;;;venda;Prado\nd;1500;;;Sion\n");
    if (!res.ok) throw new Error(res.error);
    expect(res.listings.map((l) => [l.externalId, l.purposes, l.rentCents, l.salePriceCents])).toEqual([
      ["a", ["compra"], null, 45_000_000],
      ["b", ["aluguel", "compra"], 200_000, 38_000_000],
      ["d", ["aluguel"], 150_000, null],
    ]);
    expect(res.errors).toEqual([{ line: 4, error: "preço de venda ausente ou inválido" }]);
  });

  it("imports rows and reports bad lines", () => {
    const csv = `${CSV_TEMPLATE}1;https://example.com/1;Kitnet mobiliada;kitnet;1.200;300;80;mensal;;28;1;0;1;0;mobiliado|elevador;proprietario;;https://example.com/a.jpg;Rua da Bahia;100;Centro;Belo Horizonte;30160-010;;;Perto do metrô\n2;;Sem aluguel;;;;;;;;;;;;;;;;;;Centro;;;;;\n3;;Casa;casa;3000;;;;;;;;;;;;;;;;Eldorado;Contagem;;;;\n`;
    const res = parseListingsCsv(csv);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.listings).toHaveLength(1);
    expect(res.listings[0]).toMatchObject({ type: "kitnet", rentCents: 120_000, condoCents: 30_000, iptuCents: 8_000, iptuPeriod: "mensal", advertiserType: "proprietario", neighborhood: "Centro", features: ["elevador", "mobiliado"] });
    expect(res.errors.map((e) => e.line)).toEqual([3, 4]);
  });
  it("requires the template header", () => {
    expect(parseListingsCsv("foo;bar\n1;2").ok).toBe(false);
  });
});
