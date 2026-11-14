import "server-only";
import { and, asc, desc, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { properties } from "@/db/schema";
import { RECENT_HOURS } from "@/domain/opportunity";
import { cardColumns, type PropertyCard } from "../search";

export type OpportunityTab = "melhores" | "reducao" | "abaixo" | "recentes" | "m2" | "rendimento";
export type OpportunityMode = "aluguel" | "compra";

const p = properties;
const activeIn = (mode: OpportunityMode) => sql`${p.status} = 'ativo' and ${p.listingCount} > 0 and ${mode === "compra" ? p.forSale : p.forRent}`;

/** Each tab per mode: rent compares the known monthly cost; buy compares the asking price and the yield. */
function tabs(mode: OpportunityMode): Record<OpportunityTab, { where: SQL; order: SQL[] }> {
  if (mode === "compra") {
    return {
      melhores: { where: sql`${p.saleEvalScore} >= 65`, order: [desc(p.saleEvalScore), desc(p.saleOpportunityScore), asc(p.id)] },
      reducao: { where: sql`${p.saleDropBp} > 0 and ${p.saleDroppedAt} >= now() - interval '30 days'`, order: [desc(p.saleDropBp), desc(p.saleDroppedAt)] },
      abaixo: { where: sql`${p.saleOpportunity} @> '{"signals":[{"kind":"abaixo_mercado"}]}'::jsonb`, order: [desc(p.saleOpportunityScore), asc(p.salePriceM2Cents)] },
      recentes: { where: sql`${p.firstSeenAt} >= now() - make_interval(hours => ${RECENT_HOURS})`, order: [desc(p.firstSeenAt)] },
      m2: { where: sql`${p.salePriceM2Cents} is not null and ${p.areaM2} >= 20`, order: [asc(p.salePriceM2Cents), asc(p.id)] },
      rendimento: { where: sql`${p.grossYieldBp} is not null`, order: [desc(p.grossYieldBp), asc(p.id)] },
    };
  }
  return {
    melhores: { where: sql`${p.rentEvalScore} >= 65`, order: [desc(p.rentEvalScore), desc(p.opportunityScore), asc(p.id)] },
    reducao: { where: sql`${p.dropBp} > 0 and ${p.droppedAt} >= now() - interval '30 days'`, order: [desc(p.dropBp), desc(p.droppedAt)] },
    abaixo: { where: sql`${p.opportunity} @> '{"signals":[{"kind":"abaixo_mercado"}]}'::jsonb`, order: [desc(p.opportunityScore), asc(p.costPerM2Cents)] },
    recentes: { where: sql`${p.firstSeenAt} >= now() - make_interval(hours => ${RECENT_HOURS})`, order: [desc(p.firstSeenAt)] },
    m2: { where: sql`${p.costPerM2Cents} is not null and ${p.areaM2} >= 20`, order: [asc(p.costPerM2Cents), asc(p.id)] },
    rendimento: { where: sql`false`, order: [asc(p.id)] },
  };
}

/** Properties of one detector tab (active only), best first. */
export async function opportunityList(tab: OpportunityTab, mode: OpportunityMode = "aluguel", limit = 48): Promise<PropertyCard[]> {
  const t = tabs(mode)[tab];
  const rows = await getDb().select(cardColumns).from(p).where(and(activeIn(mode), t.where)).orderBy(...t.order).limit(limit);
  return rows as PropertyCard[];
}

/** How many properties each tab has (for the tab labels). */
export async function opportunityCounts(mode: OpportunityMode = "aluguel"): Promise<Record<OpportunityTab, number>> {
  const t = tabs(mode);
  const [r] = await getDb()
    .select({
      melhores: sql<number>`count(*) filter (where ${t.melhores.where})::int`,
      reducao: sql<number>`count(*) filter (where ${t.reducao.where})::int`,
      abaixo: sql<number>`count(*) filter (where ${t.abaixo.where})::int`,
      recentes: sql<number>`count(*) filter (where ${t.recentes.where})::int`,
      m2: sql<number>`count(*) filter (where ${t.m2.where})::int`,
      rendimento: sql<number>`count(*) filter (where ${t.rendimento.where})::int`,
    })
    .from(p)
    .where(activeIn(mode));
  return r ?? { melhores: 0, reducao: 0, abaixo: 0, recentes: 0, m2: 0, rendimento: 0 };
}
