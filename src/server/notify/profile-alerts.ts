import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { maxPriceFor } from "@/domain/affordability";
import { locatedWorkplaces, rentBudgetCents } from "@/domain/profile";
import { loadProfile } from "../profile";

const MIN_SCORE = { A: 80, B: 70 } as const;
/** Per run and mode: only the very best few, so the inbox stays relevant. */
const MAX_PER_RUN = 3;
/** Never more "perfil" alerts than this in 24 h (both modes together). */
const MAX_PER_DAY = 5;

/**
 * "Oportunidade para o seu perfil": an active, real offer that reaches the owner's grade, fits
 * the commute limit (when workplaces exist) and the budget (when income/savings exist), first
 * seen in the last 7 days. Notified once per property and mode, ever. Needs a profile with
 * workplaces or finances, otherwise every B offer would be news.
 */
export async function profileMatches(): Promise<number> {
  const profile = await loadProfile();
  const hasWork = locatedWorkplaces(profile).length > 0;
  const maxBuy = maxPriceFor(profile).cents;
  const maxRent = rentBudgetCents(profile);
  if (!profile.alerts || (!hasWork && maxBuy == null)) return 0;
  const db = getDb();
  const [{ n: today } = { n: 0 }] = (await db.execute<{ n: number }>(sql`select count(*)::int as n from notifications where kind = 'perfil' and created_at > now() - interval '24 hours'`)).rows;
  let room = MAX_PER_DAY - Number(today);
  let created = 0;
  for (const mode of ["aluguel", "compra"] as const) {
    if (room <= 0) break;
    const buy = mode === "compra";
    const score = buy ? sql`p.sale_eval_score` : sql`p.rent_eval_score`;
    const evalJson = buy ? sql`p.sale_eval` : sql`p.rent_eval`;
    const price = buy ? sql`p.sale_price_cents` : sql`coalesce(p.total_cents, p.rent_cents)`;
    const budget = buy ? maxBuy : maxRent;
    const { rows } = await db.execute<{ id: number; score: number; commute: number | null; price: number | null }>(sql`
      select p.id, ${score} as score, p.commute_minutes as commute, ${price}::bigint as price
      from properties p
      where p.status = 'ativo' and not p.is_demo and ${buy ? sql`p.for_sale` : sql`p.for_rent`}
        and ${score} >= ${MIN_SCORE[profile.alertGrade]}
        and p.first_seen_at >= now() - interval '3 days'
        -- Relevance: a reliable grade (confidence not low), an exact address and photos.
        and coalesce(${evalJson}->>'confidence', 'baixa') <> 'baixa'
        and (${evalJson}->>'confidence' = 'alta' or ${score} >= 80)
        and p.geo_precision = 'exata'
        and p.photo is not null
        -- Price far below the comparables is a warning sign (error, condition, scam), not news.
        and not exists (select 1 from jsonb_array_elements_text(coalesce(${evalJson}->'cons', '[]'::jsonb)) c where c ilike '%desconfi%' or c ilike '%golpe%' or c ilike '%bom demais%')
        ${hasWork ? sql`and p.commute_minutes is not null and p.commute_minutes <= ${profile.maxCommuteMin}` : sql``}
        ${budget != null ? sql`and ${price} is not null and ${price} <= ${budget}` : sql``}
        and not exists (select 1 from notifications n where n.dedup_key = 'perfil:' || ${mode} || ':' || p.id)
      order by (p.features && array['carregador_eletrico','preparo_carregador']::text[]) desc, ${score} desc, p.commute_minutes asc nulls last
      limit ${Math.min(MAX_PER_RUN, room)}`);
    if (!rows.length) continue;
    const inserted = await db
      .insert(notifications)
      .values(rows.map((r) => ({ kind: "perfil", propertyId: r.id, dedupKey: `perfil:${mode}:${r.id}`, payload: { mode, score: Number(r.score), commuteMinutes: r.commute == null ? null : Number(r.commute) } })))
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    created += inserted.length;
    room -= inserted.length;
  }
  return created;
}

/**
 * EV charging is the owner's top priority and rare in listings: every real, active property that
 * states a charger (or prepared infrastructure) is notified once, in each mode it is offered.
 */
export async function evChargerMatches(): Promise<number> {
  const db = getDb();
  let created = 0;
  for (const mode of ["aluguel", "compra"] as const) {
    const { rows } = await db.execute<{ id: number }>(sql`
      select p.id from properties p
      where p.status = 'ativo' and not p.is_demo and ${mode === "compra" ? sql`p.for_sale` : sql`p.for_rent`}
        and p.features && array['carregador_eletrico','preparo_carregador']::text[]
        and not exists (select 1 from notifications n where n.dedup_key = 'carregador:' || ${mode} || ':' || p.id)
      order by p.first_seen_at desc
      limit ${MAX_PER_RUN}`);
    if (!rows.length) continue;
    const inserted = await db
      .insert(notifications)
      .values(rows.map((r) => ({ kind: "carregador", propertyId: r.id, dedupKey: `carregador:${mode}:${r.id}`, payload: { mode } })))
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    created += inserted.length;
  }
  return created;
}
