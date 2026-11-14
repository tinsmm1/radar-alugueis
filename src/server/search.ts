import "server-only";
import { and, arrayContains, arrayOverlaps, asc, desc, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { properties } from "@/db/schema";
import type { Filter } from "@/domain/filters";
import { parseBbox } from "@/domain/geo";
import { escapeLike, normalizeText } from "@/domain/text";

const p = properties;
const reais = (v: number) => v * 100;
const RISK_ORDER = ["baixo", "moderado", "atencao", "alto"];
const GRADE_MIN = { A: 80, B: 65, C: 50 } as const;

/** Every filter field as SQL on `properties` (shared by list, map, saved searches and alerts). */
export function whereFor(f: Filter, opts: { ignoreBbox?: boolean; ids?: number[] } = {}): SQL {
  const buy = f.modo === "compra";
  const c: Array<SQL | undefined> = [sql`${p.listingCount} > 0`, buy ? sql`${p.forSale}` : sql`${p.forRent}`];
  c.push(f.incluirIndisponiveis ? undefined : sql`${p.status} <> 'indisponivel'`);
  if (opts.ids) c.push(opts.ids.length ? inArray(p.id, opts.ids) : sql`false`);
  if (f.q) {
    const term = `%${escapeLike(normalizeText(f.q))}%`;
    c.push(sql`(${p.search} like ${term} or ${p.neighborhoodKey} like ${term} or lower(coalesce(${p.regional}, '')) like ${term})`);
  }
  if (f.bairros.length) c.push(inArray(p.neighborhoodKey, f.bairros.map(normalizeText)));
  if (f.regionais.length) c.push(inArray(p.regional, f.regionais));
  if (f.perto) {
    const [lat, lng] = f.perto.split(",").map(Number);
    c.push(sql`ST_DWithin(${p.geom}::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${(f.raioKm ?? 2) * 1000})`);
  }
  const box = !opts.ignoreBbox && parseBbox(f.bbox);
  if (box) c.push(sql`${p.geom} && ST_MakeEnvelope(${box.west}, ${box.south}, ${box.east}, ${box.north}, 4326)`);
  const range = (col: AnyPgColumn, min?: number, max?: number) => {
    if (min != null) c.push(gte(col, reais(min)));
    if (max != null) c.push(lte(col, reais(max)));
  };
  range(p.condoCents, f.condoMin, f.condoMax);
  range(p.iptuMonthlyCents, f.iptuMin, f.iptuMax);
  if (buy) {
    range(p.salePriceCents, f.precoMin, f.precoMax);
    if (f.precoM2Max != null) c.push(lte(p.salePriceM2Cents, reais(f.precoM2Max)));
    if (f.rendimentoMin != null) c.push(gte(p.grossYieldBp, Math.round(f.rendimentoMin * 100)));
  } else {
    range(p.rentCents, f.aluguelMin, f.aluguelMax);
    range(p.totalCents, f.totalMin, f.totalMax);
    if (f.m2Max != null) c.push(lte(p.costPerM2Cents, reais(f.m2Max)));
  }
  if (f.areaMin != null) c.push(gte(p.areaM2, f.areaMin));
  if (f.areaMax != null) c.push(lte(p.areaM2, f.areaMax));
  if (f.quartosMin != null) c.push(gte(p.bedrooms, f.quartosMin));
  if (f.quartosMax != null) c.push(lte(p.bedrooms, f.quartosMax));
  if (f.suitesMin != null) c.push(gte(p.suites, f.suitesMin));
  if (f.banheirosMin != null) c.push(gte(p.bathrooms, f.banheirosMin));
  if (f.vagasMin != null) c.push(gte(p.parking, f.vagasMin));
  if (f.tipos.length) c.push(inArray(p.type, f.tipos));
  if (f.caracteristicas.length) c.push(arrayContains(p.features, f.caracteristicas));
  if (f.recentesDias) c.push(sql`${p.firstSeenAt} >= now() - make_interval(days => ${f.recentesDias})`);
  if (f.atualizadosDias) c.push(sql`${p.updatedAt} >= now() - make_interval(days => ${f.atualizadosDias})`);
  if (f.reducao) c.push(buy ? sql`${p.saleDropBp} > 0 and ${p.saleDroppedAt} >= now() - interval '60 days'` : sql`${p.dropBp} > 0 and ${p.droppedAt} >= now() - interval '60 days'`);
  if (f.anunciante) c.push(arrayContains(p.advertiserTypes, [f.anunciante]));
  if (f.localizacao === "confirmada") c.push(inArray(p.geoPrecision, ["exata"]));
  if (f.localizacao === "aproximada") c.push(sql`(${p.geoPrecision} is null or ${p.geoPrecision} in ('rua', 'bairro', 'aproximada'))`);
  if (f.custoCompleto) c.push(buy ? sql`${p.condoCents} is not null and ${p.iptuMonthlyCents} is not null` : sql`${p.costStatus} = 'completo'`);
  if (f.riscoMax) c.push(inArray(p.riskLevel, RISK_ORDER.slice(0, RISK_ORDER.indexOf(f.riscoMax) + 1)));
  if (f.semInundacao) c.push(sql`${p.analyzedAt} is not null and coalesce(${p.floodLevel}, 0) = 0`);
  if (f.notaMin) c.push(gte(buy ? p.saleEvalScore : p.rentEvalScore, GRADE_MIN[f.notaMin]));
  if (f.oportunidades) c.push(buy ? sql`${p.saleOpportunityScore} > 0` : sql`${p.opportunityScore} > 0`);
  if (f.favoritos) c.push(sql`exists (select 1 from favorites fv where fv.property_id = ${p.id})`);
  if (f.fontes.length) c.push(arrayOverlaps(p.sourceKeys, f.fontes));
  return and(...c.filter((x): x is SQL => Boolean(x)))!;
}

function orderFor(f: Filter): SQL[] {
  const nulls = (col: SQL | AnyPgColumn, dir: "asc" | "desc" = "asc") => sql`${col} ${sql.raw(dir)} nulls last`;
  const buy = f.modo === "compra";
  const opp = buy ? p.saleOpportunityScore : p.opportunityScore;
  switch (f.ordem) {
    case "menor_preco": return [nulls(p.salePriceCents), asc(p.id)];
    case "menor_preco_m2": return [nulls(p.salePriceM2Cents), asc(p.id)];
    case "maior_rendimento": return [nulls(p.grossYieldBp, "desc"), asc(p.id)];
    case "menor_total": return [nulls(buy ? p.salePriceCents : p.totalCents), asc(p.id)];
    case "menor_aluguel": return [nulls(p.rentCents), asc(p.id)];
    case "menor_m2": return [nulls(p.costPerM2Cents), asc(p.id)];
    case "maior_area": return [nulls(p.areaM2, "desc"), asc(p.id)];
    case "recentes": return [desc(p.firstSeenAt), asc(p.id)];
    case "maior_reducao": return [nulls(buy ? p.saleDropBp : p.dropBp, "desc"), asc(p.id)];
    case "menor_risco": return [nulls(p.riskScore), asc(p.id)];
    case "melhor_avaliacao": return [nulls(buy ? p.saleEvalScore : p.rentEvalScore, "desc"), desc(opp), asc(p.id)];
    case "oportunidade": return [desc(opp), nulls(buy ? p.salePriceM2Cents : p.costPerM2Cents), asc(p.id)];
    default: return [sql`(${p.status} = 'ativo') desc`, desc(opp), desc(p.firstSeenAt), asc(p.id)];
  }
}

export const cardColumns = {
  id: p.id, title: p.title, type: p.type, neighborhood: p.neighborhood, regional: p.regional, street: p.street, photo: p.photo,
  rentCents: p.rentCents, condoCents: p.condoCents, iptuMonthlyCents: p.iptuMonthlyCents, totalCents: p.totalCents, costStatus: p.costStatus,
  costPerM2Cents: p.costPerM2Cents, areaM2: p.areaM2, bedrooms: p.bedrooms, suites: p.suites, bathrooms: p.bathrooms, parking: p.parking,
  features: p.features, sourceKeys: p.sourceKeys, listingCount: p.listingCount, status: p.status, isDemo: p.isDemo, lastSeenAt: p.lastSeenAt,
  firstSeenAt: p.firstSeenAt, dropBp: p.dropBp, droppedAt: p.droppedAt, lat: p.lat, lng: p.lng, geoPrecision: p.geoPrecision,
  riskScore: p.riskScore, riskLevel: p.riskLevel, opportunity: p.opportunity, opportunityScore: p.opportunityScore,
  forRent: p.forRent, forSale: p.forSale, salePriceCents: p.salePriceCents, salePriceM2Cents: p.salePriceM2Cents, saleDropBp: p.saleDropBp, saleDroppedAt: p.saleDroppedAt,
  estRentCents: p.estRentCents, grossYieldBp: p.grossYieldBp, saleOpportunity: p.saleOpportunity, saleOpportunityScore: p.saleOpportunityScore,
  rentEvalScore: p.rentEvalScore, saleEvalScore: p.saleEvalScore,
};
export type PropertyCard = { [K in keyof typeof cardColumns]: (typeof cardColumns)[K]["_"]["data"] | null } & { id: number; features: string[]; sourceKeys: string[] };

export const PAGE_SIZE = 24;

export type SearchStats = {
  total: number; avgRentCents: number | null; minRentCents: number | null; minTotalCents: number | null; avgAreaM2: number | null; new24h: number; located: number;
  /** Buy mode. */
  avgPriceCents: number | null; minPriceCents: number | null; medianPriceM2Cents: number | null; avgYieldBp: number | null;
};

export async function searchProperties(f: Filter, page = 1): Promise<{ items: PropertyCard[]; stats: SearchStats; pages: number }> {
  const db = getDb();
  const where = whereFor(f);
  const [items, [stats]] = await Promise.all([
    db.select(cardColumns).from(p).where(where).orderBy(...orderFor(f)).limit(PAGE_SIZE).offset((Math.max(1, page) - 1) * PAGE_SIZE),
    db
      .select({
        total: sql<number>`count(*)::int`,
        avgRentCents: sql<number | null>`round(avg(${p.rentCents}))::int`,
        minRentCents: sql<number | null>`min(${p.rentCents})`,
        minTotalCents: sql<number | null>`min(${p.totalCents})`,
        avgAreaM2: sql<number | null>`round(avg(${p.areaM2})::numeric, 1)::float`,
        new24h: sql<number>`count(*) filter (where ${p.firstSeenAt} >= now() - interval '24 hours')::int`,
        located: sql<number>`count(${p.geom})::int`,
        avgPriceCents: sql<number | null>`round(avg(${p.salePriceCents}))::bigint`,
        minPriceCents: sql<number | null>`min(${p.salePriceCents})`,
        medianPriceM2Cents: sql<number | null>`(percentile_cont(0.5) within group (order by ${p.salePriceM2Cents}))::int`,
        avgYieldBp: sql<number | null>`round(avg(${p.grossYieldBp}))::int`,
      })
      .from(p)
      .where(where),
  ]);
  const st = { ...stats!, avgPriceCents: stats!.avgPriceCents == null ? null : Number(stats!.avgPriceCents), minPriceCents: stats!.minPriceCents == null ? null : Number(stats!.minPriceCents) };
  return { items: items as PropertyCard[], stats: st, pages: Math.max(1, Math.ceil(st.total / PAGE_SIZE)) };
}

/** totalCents is the price shown on the pin: known monthly total when renting, asking price when buying. */
export type MapPoint = { id: number; lat: number; lng: number; totalCents: number | null; rentCents: number | null; precision: string | null; risk: string | null; demo: boolean; drop: boolean; opp: number };

/** Every located match (the map clusters them client-side); capped for safety. */
export async function mapPoints(f: Filter): Promise<MapPoint[]> {
  const rows = await getDb()
    .select({ id: p.id, lat: p.lat, lng: p.lng, totalCents: f.modo === "compra" ? p.salePriceCents : p.totalCents, rentCents: p.rentCents, precision: p.geoPrecision, risk: p.riskLevel, demo: p.isDemo, dropBp: f.modo === "compra" ? p.saleDropBp : p.dropBp, opp: f.modo === "compra" ? p.saleOpportunityScore : p.opportunityScore })
    .from(p)
    .where(and(whereFor(f, { ignoreBbox: true }), sql`${p.geom} is not null`))
    .limit(5000);
  return rows.map((r) => ({ id: r.id, lat: r.lat!, lng: r.lng!, totalCents: r.totalCents == null ? null : Number(r.totalCents), rentCents: r.rentCents, precision: r.precision, risk: r.risk, demo: r.demo, drop: (r.dropBp ?? 0) > 0, opp: r.opp }));
}

/** Matching property ids among candidates (saved-search notifications). */
export async function matchingIds(f: Filter, ids: number[]): Promise<number[]> {
  if (!ids.length) return [];
  const rows = await getDb().select({ id: p.id }).from(p).where(whereFor(f, { ids }));
  return rows.map((r) => r.id);
}

/** Options for the filter panel: neighbourhoods and regionais with counts, sources in use. */
export async function facets(modo: "aluguel" | "compra" = "aluguel"): Promise<{ bairros: Array<{ name: string; count: number }>; regionais: Array<{ name: string; count: number }>; fontes: string[] }> {
  const db = getDb();
  const active = sql`${p.listingCount} > 0 and ${p.status} <> 'indisponivel' and ${modo === "compra" ? p.forSale : p.forRent}`;
  const [bairros, regionais, fontes] = await Promise.all([
    db.select({ name: sql<string>`min(${p.neighborhood})`, count: sql<number>`count(*)::int` }).from(p).where(and(active, sql`${p.neighborhoodKey} is not null`)).groupBy(p.neighborhoodKey).orderBy(sql`min(${p.neighborhood})`),
    db.select({ name: sql<string>`${p.regional}`, count: sql<number>`count(*)::int` }).from(p).where(and(active, sql`${p.regional} is not null`)).groupBy(p.regional).orderBy(p.regional),
    db.select({ key: sql<string>`distinct unnest(${p.sourceKeys})` }).from(p).where(active),
  ]);
  return { bairros, regionais: regionais as Array<{ name: string; count: number }>, fontes: fontes.map((x) => x.key).sort() };
}
