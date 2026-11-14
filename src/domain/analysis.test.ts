import { describe, expect, it } from "vitest";
import { compareListings, groupDuplicates, streetKey, type DedupCandidate } from "./dedup";
import { activeCount, describeFilter, EMPTY_FILTER, filterFromParams, filterSchema, filterToParams } from "./filters";
import { haversine, hornSlopePercent, parseBbox, terrariumElevation, tileOf, tilesFor } from "./geo";
import { classLevel } from "./layers";
import { dropBp, priceChanged, reconcileMissing, type Known } from "./lifecycle";
import { belowMarket, buildStats, comparableMedian, median, opportunity, type Comparable } from "./opportunity";
import { analysisItems, NO_RECORD_NOTE, riskIndex, type LocationFacts } from "./risk";

const base: DedupCandidate = {
  id: 1, type: "apartamento", street: "Rua Pernambuco", number: "1000", neighborhood: "Savassi", areaM2: 92, bedrooms: 3, suites: 1, bathrooms: 2, parking: 2,
  rentCents: 350_000, lat: -19.9367, lng: -43.9339, preciseLocation: true, title: "Apartamento 3 quartos com suíte e varanda", description: null, features: ["varanda", "elevador"],
};

describe("deduplication", () => {
  it("same address, area and rooms → same property", () => {
    const other = { ...base, id: 2, street: "R. Pernambuco", rentCents: 340_000, title: "3 quartos com varanda e suíte na Savassi" };
    const m = compareListings(base, other);
    expect(m.verdict).toBe("mesmo");
    expect(m.reasons).toContain("mesmo endereço e número");
  });
  it("hard differences rule it out", () => {
    expect(compareListings(base, { ...base, id: 2, bedrooms: 2 }).verdict).toBe("diferente");
    expect(compareListings(base, { ...base, id: 2, areaM2: 130 }).verdict).toBe("diferente");
    expect(compareListings(base, { ...base, id: 2, number: "1200" }).verdict).toBe("diferente");
    expect(compareListings(base, { ...base, id: 2, type: "casa" }).verdict).toBe("diferente");
  });
  it("similar but unproven → possible duplicate, never merged", () => {
    const other = { ...base, id: 2, street: null, number: null, lat: null, lng: null, preciseLocation: false, title: "Apartamento 3 quartos com suíte e varanda" };
    const m = compareListings(base, other);
    expect(m.verdict).toBe("possivel");
    const g = groupDuplicates([base, other]);
    expect(g.groups).toHaveLength(2);
    expect(g.possible).toEqual([[1, 2, m.score]]);
  });
  it("groups chains within a block only", () => {
    const b = { ...base, id: 2, street: "R. Pernambuco" };
    const c = { ...base, id: 3, neighborhood: "Funcionários", street: "Rua Outra", number: "5", lat: -19.95, lng: -43.95 };
    expect(groupDuplicates([base, b, c]).groups).toEqual([[1, 2], [3]]);
  });
  it("street keys expand abbreviations", () => {
    expect(streetKey("Av. Afonso Pena, 1500")).toBe("avenida afonso pena");
  });
});

describe("lifecycle", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const k = (id: string, missingCount = 0, hoursAgo = 12, status: Known["status"] = "ativo"): Known => ({ externalId: id, status, missingCount, lastSeenAt: new Date(now.getTime() - hoursAgo * 3_600_000) });
  it("first miss → possibly unavailable; repeated old miss → unavailable", () => {
    const { transitions } = reconcileMissing([k("a"), k("b", 1, 40, "possivelmente_indisponivel"), k("c")], new Set(["c"]), now, true);
    expect(transitions).toEqual([
      { externalId: "a", status: "possivelmente_indisponivel", missingCount: 1, event: "sumiu" },
      { externalId: "b", status: "indisponivel", missingCount: 2, event: "indisponivel" },
    ]);
  });
  it("partial sources and truncated snapshots never mark misses", () => {
    expect(reconcileMissing([k("a")], new Set(), now, false).transitions).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => k(`x${i}`));
    expect(reconcileMissing(many, new Set(["x1", "x2"]), now, true)).toEqual({ transitions: [], partial: true });
  });
  it("price changes and drops", () => {
    expect(priceChanged({ rentCents: 1, condoCents: null, iptuCents: null }, { rentCents: 1, condoCents: 5, iptuCents: null })).toBe(true);
    expect(priceChanged({ rentCents: 1, condoCents: 5, iptuCents: null }, { rentCents: 1, condoCents: null, iptuCents: null })).toBe(false);
    expect(dropBp(400_000, 360_000)).toBe(1000);
    expect(dropBp(400_000, 420_000)).toBeNull();
  });
});

describe("filters", () => {
  it("round-trips through the URL", () => {
    const f = filterSchema.parse({ q: "savassi", bairros: ["Savassi", "Lourdes"], perto: "-19.93,-43.93", raioKm: 1.5, totalMax: 5000, quartosMin: 2, tipos: ["apartamento"], caracteristicas: ["elevador"], reducao: true, riscoMax: "moderado", ordem: "menor_m2" });
    expect(filterFromParams(filterToParams(f))).toEqual(f);
  });
  it("drops invalid parts only", () => {
    const f = filterFromParams(new URLSearchParams("quartosMin=99&bairros=Centro&tipos=castelo&ordem=x"));
    expect(f).toEqual({ ...EMPTY_FILTER, bairros: ["Centro"] });
  });
  it("counts and describes", () => {
    const f = filterSchema.parse({ bairros: ["Centro"], aluguelMax: 3000, caracteristicas: ["piscina"], anunciante: "proprietario" });
    expect(activeCount(f)).toBe(4);
    expect(describeFilter(f)).toBe("Alugar · Centro · aluguel ≤ R$ 3.000 · Piscina · direto com proprietário");
    expect(describeFilter(EMPTY_FILTER)).toBe("Alugar: todos os imóveis");
    const buy = filterSchema.parse({ modo: "compra", precoMax: 600_000, precoM2Max: 8000, rendimentoMin: 5.5, ordem: "maior_rendimento" });
    expect(describeFilter(buy)).toBe("Comprar · preço ≤ R$ 600.000 · até R$ 8.000/m² · rendimento ≥ 5,5% a.a.");
    expect(activeCount(buy)).toBe(3);
    expect(filterFromParams(filterToParams(buy))).toEqual(buy);
    expect(filterToParams(EMPTY_FILTER).toString()).toBe("");
  });
});

describe("geo", () => {
  it("distances, tiles and bbox", () => {
    expect(haversine(-19.9191, -43.9386, -19.9291, -43.9386)).toBeCloseTo(1112, -1);
    const t = tileOf(-43.9378, -19.9208, 14);
    expect(t).toEqual({ x: 6192, y: 9117 });
    expect(tilesFor({ west: -43.94, south: -19.93, east: -43.93, north: -19.92 }, 14).length).toBeGreaterThan(0);
    expect(parseBbox("-44,-20,-43.8,-19.7")).toEqual({ west: -44, south: -20, east: -43.8, north: -19.7 });
    expect(parseBbox("1,2,3")).toBeNull();
  });
  it("terrain and slope", () => {
    expect(terrariumElevation(131, 30, 128)).toBeCloseTo(798.5, 1);
    // 3 m rise per 10 m cell along x → 30%.
    expect(hornSlopePercent([0, 3, 6, 0, 3, 6, 0, 3, 6], 10)).toBe(30);
    expect(hornSlopePercent([5, 5, 5, 5, 5, 5, 5, 5, 5], 10)).toBe(0);
  });
  it("class levels", () => {
    expect([classLevel("Alta"), classLevel("Média"), classLevel("Baixa"), classLevel("Suscetível"), classLevel(null)]).toEqual([3, 2, 1, 2, 0]);
  });
});

describe("opportunities", () => {
  const market: Comparable[] = Array.from({ length: 8 }, (_, i) => ({ id: i + 10, neighborhood: "Centro", regional: "Centro-Sul", type: "apartamento", bedrooms: 2, costPerM2: 5_000 + i * 100 }));
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBeNull();
  });
  it("below comparables needs ≥5 comparables and ≥15% below", () => {
    const cheap: Comparable = { id: 1, neighborhood: "Centro", regional: "Centro-Sul", type: "apartamento", bedrooms: 2, costPerM2: 4_000 };
    const stats = buildStats([...market, cheap]);
    const b = belowMarket(cheap, stats);
    expect(b).toMatchObject({ scope: "bairro", comparables: 8 });
    expect(b!.pctBelow).toBeGreaterThan(15);
    expect(belowMarket({ ...cheap, costPerM2: 5_200 }, stats)).toBeNull();
    expect(belowMarket({ ...cheap, neighborhood: "Outro", regional: "Outra" }, stats)).toBeNull();
  });
  it("comparable median (for rent estimates) and high-yield signal", () => {
    const stats = buildStats(market);
    expect(comparableMedian({ ...market[0], id: 99, costPerM2: null }, stats, false)).toMatchObject({ scope: "bairro", comparables: 8, median: 5_350 });
    expect(comparableMedian({ ...market[0], neighborhood: "X", regional: "Y" }, stats)).toBeNull();
    const now = new Date("2026-11-13T12:00:00Z");
    const o = opportunity({ dropBp: null, droppedAt: null, firstSeenAt: new Date("2026-10-01T00:00:00Z"), below: null, yieldBp: 720 }, now);
    expect(o.signals).toEqual([{ kind: "alto_rendimento", yieldBp: 720 }]);
    expect(opportunity({ dropBp: null, droppedAt: null, firstSeenAt: new Date("2026-10-01T00:00:00Z"), below: null, yieldBp: 450 }, now).signals).toEqual([]);
  });

  it("score combines drop, market and freshness", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    const o = opportunity({ dropBp: 1000, droppedAt: new Date("2026-11-12T12:00:00Z"), firstSeenAt: new Date("2026-11-13T00:00:00Z"), below: null }, now);
    expect(o.signals.map((s) => s.kind)).toEqual(["baixa_preco", "recente"]);
    expect(o.score).toBe(35);
  });
});

describe("location analysis", () => {
  const facts: LocationFacts = {
    precision: "exata",
    coverage: { sgb: true, osm: true, terrain: true, imported: false },
    flood: { insideClass: "Alta", insideLevel: 3, nearHighM: 0 },
    landslide: { insideClass: null, insideLevel: 0, nearHighM: null },
    flashFlood: { inside: false },
    mapped: [],
    slopePct: 8,
    nearest: { curso_dagua: { distanceM: 40, name: "Córrego do Leitão" }, metro: { distanceM: 650, name: "Estação Central" }, via_principal: { distanceM: 30, name: "Av. do Contorno" }, parque: { distanceM: 400, name: "Parque Municipal" } },
    analyzedAt: "2026-11-13T09:00:00Z",
  };
  it("items have class, description, distance and source; absence is never 'no risk'", () => {
    const items = analysisItems(facts);
    const flood = items.find((i) => i.key === "sgb_inundacao")!;
    expect(flood).toMatchObject({ level: "alto", category: "suscetibilidade", distanceM: 0 });
    expect(flood.source).toContain("SGB");
    const landslide = items.find((i) => i.key === "sgb_movimento_massa")!;
    expect(landslide.level).toBe("baixo");
    const lowInside = analysisItems({ ...facts, landslide: { insideClass: "Baixa", insideLevel: 1, nearHighM: null } }).find((i) => i.key === "sgb_movimento_massa")!;
    expect(lowInside).toMatchObject({ level: "baixo" });
    expect(lowInside.description).toContain(NO_RECORD_NOTE);
    expect(landslide.description).toContain(NO_RECORD_NOTE);
    expect(items.find((i) => i.key === "pbh")!.level).toBe("sem_dados");
    expect(items.find((i) => i.key === "metro")).toMatchObject({ level: "positivo", distanceM: 650 });
    expect(items.find((i) => i.key === "curso_dagua")!.description).toContain("Córrego do Leitão");
  });
  it("missing layers are reported, never invented", () => {
    const items = analysisItems({ ...facts, coverage: { sgb: false, osm: false, terrain: false, imported: false }, flood: null, landslide: null, nearest: {}, slopePct: null });
    expect(items.filter((i) => i.level === "sem_dados").map((i) => i.key)).toEqual(expect.arrayContaining(["sgb_inundacao", "sgb_movimento_massa", "declividade", "pbh"]));
  });
  it("risk index sums components with reasons and confidence", () => {
    const r = riskIndex(facts);
    expect(r.score).toBe(35 + 15 + 6);
    expect(r.level).toBe("atencao");
    expect(r.reasons).toContain("inundação: suscetibilidade alta");
    expect(riskIndex({ ...facts, precision: "aproximada" }).confidence).toBe("reduzida");
    const calm = riskIndex({ ...facts, flood: { insideClass: null, insideLevel: 0, nearHighM: null }, nearest: {} });
    expect(calm).toMatchObject({ score: 0, level: "baixo" });
    // Low inside but high 10 m away: the stronger reading counts.
    const near = riskIndex({ ...facts, flood: { insideClass: "Baixa", insideLevel: 1, nearHighM: 10 }, nearest: {} });
    expect(near.score).toBe(12);
    expect(near.reasons).toEqual(["inundação: suscetibilidade alta a 10 m"]);
  });
});
