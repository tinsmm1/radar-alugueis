import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { properties } from "@/db/schema";
import { belowMarket, buildStats, comparableMedian, opportunity, type Comparable } from "@/domain/opportunity";
import { grossYieldBp } from "@/domain/purchase";
import { evaluate, type EvalInput, type Evaluation } from "@/domain/evaluation";
import { riskIndex, type LocationFacts } from "@/domain/risk";

type Row = {
  id: number; neighborhood: string | null; regional: string | null; type: string | null; bedrooms: number | null; areaM2: number | null; isDemo: boolean;
  forRent: boolean; forSale: boolean; rentCents: number | null; costPerM2: number | null; salePriceCents: number | null; salePriceM2: number | null;
  dropBp: number | null; droppedAt: Date | null; saleDropBp: number | null; saleDroppedAt: Date | null; firstSeenAt: Date;
  analysis: unknown; parking: number | null; features: string[]; costStatus: string | null; geoPrecision: string | null; sourceKeys: string[];
};

const DAY = 86_400_000;
const recent = (bp: number | null, at: Date | null, now: Date) => (bp && at && now.getTime() - at.getTime() <= 30 * DAY ? bp : null);

/** Evaluation of one offer: price against its comparables plus the location and the home. */
function evaluationOf(r: Row, mode: "aluguel" | "compra", own: number | null, stats: ReturnType<typeof buildStats>, extra: Pick<EvalInput, "recentDropBp" | "costComplete" | "yieldBp">): Evaluation {
  const med = own != null ? comparableMedian({ ...base(r), costPerM2: own }, stats) : null;
  const facts = (r.analysis ?? null) as LocationFacts | null;
  return evaluate({
    mode, ...extra,
    priceVsMedianPct: med && own != null ? Math.round(((med.median - own) / med.median) * 1000) / 10 : null,
    comparables: med?.comparables ?? 0, comparableScope: med?.scope ?? null,
    facts, risk: facts ? riskIndex(facts) : null,
    parking: r.parking, featureCount: r.features.length, areaM2: r.areaM2, exactLocation: r.geoPrecision === "exata", sources: r.sourceKeys.length,
  });
}

const base = (r: Row): Omit<Comparable, "costPerM2"> => ({ id: r.id, neighborhood: r.neighborhood, regional: r.regional, type: r.type, bedrooms: r.bedrooms });

/**
 * Recomputes both markets against current comparables (neighbourhood or regional, type group,
 * bedrooms):
 * - rent: known monthly cost per m² vs comparables, price drops, fresh listings;
 * - sale: asking price per m² vs comparables, price drops, fresh listings, and the gross yield
 *   from a rent estimated with the median rent per m² of comparable rentals.
 * Each offer also gets its critical evaluation (src/domain/evaluation.ts) per mode.
 * Demo listings are compared only among themselves.
 */
export async function refreshOpportunities(now = new Date()): Promise<{ withSignals: number; saleWithSignals: number }> {
  const db = getDb();
  const rows = (await db
    .select({
      id: properties.id, neighborhood: properties.neighborhood, regional: properties.regional, type: properties.type, bedrooms: properties.bedrooms, areaM2: properties.areaM2,
      isDemo: properties.isDemo, forRent: properties.forRent, forSale: properties.forSale, rentCents: properties.rentCents, costPerM2: properties.costPerM2Cents,
      salePriceCents: properties.salePriceCents, salePriceM2: properties.salePriceM2Cents, dropBp: properties.dropBp, droppedAt: properties.droppedAt,
      saleDropBp: properties.saleDropBp, saleDroppedAt: properties.saleDroppedAt, firstSeenAt: properties.firstSeenAt,
      analysis: properties.analysis, parking: properties.parking, features: properties.features, costStatus: properties.costStatus, geoPrecision: properties.geoPrecision, sourceKeys: properties.sourceKeys,
    })
    .from(properties)
    .where(sql`${properties.status} = 'ativo' and ${properties.listingCount} > 0`)) as Row[];

  const rent: Array<{ id: number; score: number; data: unknown; ev: Evaluation }> = [];
  const sale: Array<{ id: number; score: number; data: unknown; estRent: number | null; yieldBp: number | null; ev: Evaluation }> = [];
  for (const demo of [false, true]) {
    const market = rows.filter((r) => r.isDemo === demo);
    const rentals = market.filter((r) => r.forRent);
    const sales = market.filter((r) => r.forSale);
    const costStats = buildStats(rentals.map((r) => ({ ...base(r), costPerM2: r.costPerM2 })));
    const rentM2Stats = buildStats(rentals.map((r) => ({ ...base(r), costPerM2: r.rentCents != null && r.areaM2 ? Math.round(r.rentCents / r.areaM2) : null })));
    const saleStats = buildStats(sales.map((r) => ({ ...base(r), costPerM2: r.salePriceM2 })));
    for (const r of rentals) {
      const o = opportunity({ dropBp: r.dropBp, droppedAt: r.droppedAt, firstSeenAt: r.firstSeenAt, below: belowMarket({ ...base(r), costPerM2: r.costPerM2 }, costStats) }, now);
      const ev = evaluationOf(r, "aluguel", r.costPerM2, costStats, { recentDropBp: recent(r.dropBp, r.droppedAt, now), costComplete: r.costStatus == null ? null : r.costStatus === "completo", yieldBp: null });
      rent.push({ id: r.id, score: o.score, data: o.signals.length ? o : null, ev });
    }
    for (const r of sales) {
      const est = r.areaM2 ? comparableMedian({ ...base(r), costPerM2: null }, rentM2Stats, false) : null;
      const estRent = est && r.areaM2 ? Math.round((est.median * r.areaM2) / 100) * 100 : null;
      const yieldBp = grossYieldBp(estRent, r.salePriceCents);
      const o = opportunity({ dropBp: r.saleDropBp, droppedAt: r.saleDroppedAt, firstSeenAt: r.firstSeenAt, below: belowMarket({ ...base(r), costPerM2: r.salePriceM2 }, saleStats), yieldBp }, now);
      const ev = evaluationOf(r, "compra", r.salePriceM2, saleStats, { recentDropBp: recent(r.saleDropBp, r.saleDroppedAt, now), costComplete: null, yieldBp });
      sale.push({ id: r.id, score: o.score, data: o.signals.length || est ? { ...o, rentEstimate: est ? { ...est, cents: estRent } : null } : null, estRent, yieldBp, ev });
    }
  }
  for (let i = 0; i < rent.length; i += 500) {
    const values = sql.join(rent.slice(i, i + 500).map((u) => sql`(${u.id}::int, ${u.score}::smallint, ${JSON.stringify(u.data)}::jsonb, ${u.ev.score}::smallint, ${JSON.stringify(u.ev)}::jsonb)`), sql`, `);
    await db.execute(sql`update properties p set opportunity_score = v.score, opportunity = nullif(v.data, 'null'::jsonb), rent_eval_score = v.es, rent_eval = v.ev from (values ${values}) as v(id, score, data, es, ev) where p.id = v.id`);
  }
  for (let i = 0; i < sale.length; i += 500) {
    const values = sql.join(sale.slice(i, i + 500).map((u) => sql`(${u.id}::int, ${u.score}::smallint, ${JSON.stringify(u.data)}::jsonb, ${u.estRent}::int, ${u.yieldBp}::int, ${u.ev.score}::smallint, ${JSON.stringify(u.ev)}::jsonb)`), sql`, `);
    await db.execute(sql`update properties p set sale_opportunity_score = v.score, sale_opportunity = nullif(v.data, 'null'::jsonb), est_rent_cents = v.est, gross_yield_bp = v.y, sale_eval_score = v.es, sale_eval = v.ev from (values ${values}) as v(id, score, data, est, y, es, ev) where p.id = v.id`);
  }
  // Signals only describe what is on offer now.
  await db.execute(sql`update properties set opportunity_score = 0, opportunity = null, rent_eval_score = null, rent_eval = null where (status <> 'ativo' or not for_rent) and (opportunity_score <> 0 or opportunity is not null or rent_eval is not null)`);
  await db.execute(sql`update properties set sale_opportunity_score = 0, sale_opportunity = null, est_rent_cents = null, gross_yield_bp = null, sale_eval_score = null, sale_eval = null where (status <> 'ativo' or not for_sale) and (sale_opportunity_score <> 0 or sale_opportunity is not null or sale_eval is not null)`);
  return { withSignals: rent.filter((u) => u.score > 0).length, saleWithSignals: sale.filter((u) => u.score > 0).length };
}
