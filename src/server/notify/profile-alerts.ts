import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { maxPriceFor } from "@/domain/affordability";
import { locatedWorkplaces, rentBudgetCents } from "@/domain/profile";
import { loadProfile } from "../profile";

const MIN_SCORE = { A: 80, B: 65 } as const;
/** Per run and mode, so turning alerts on never floods the inbox. */
const MAX_PER_RUN = 10;

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
  let created = 0;
  for (const mode of ["aluguel", "compra"] as const) {
    const buy = mode === "compra";
    const score = buy ? sql`p.sale_eval_score` : sql`p.rent_eval_score`;
    const price = buy ? sql`p.sale_price_cents` : sql`coalesce(p.total_cents, p.rent_cents)`;
    const budget = buy ? maxBuy : maxRent;
    const { rows } = await db.execute<{ id: number; score: number; commute: number | null; price: number | null }>(sql`
      select p.id, ${score} as score, p.commute_minutes as commute, ${price}::bigint as price
      from properties p
      where p.status = 'ativo' and not p.is_demo and ${buy ? sql`p.for_sale` : sql`p.for_rent`}
        and ${score} >= ${MIN_SCORE[profile.alertGrade]}
        and p.first_seen_at >= now() - interval '7 days'
        ${hasWork ? sql`and p.commute_minutes is not null and p.commute_minutes <= ${profile.maxCommuteMin}` : sql``}
        ${budget != null ? sql`and ${price} is not null and ${price} <= ${budget}` : sql``}
        and not exists (select 1 from notifications n where n.dedup_key = 'perfil:' || ${mode} || ':' || p.id)
      order by ${score} desc
      limit ${MAX_PER_RUN}`);
    if (!rows.length) continue;
    const inserted = await db
      .insert(notifications)
      .values(rows.map((r) => ({ kind: "perfil", propertyId: r.id, dedupKey: `perfil:${mode}:${r.id}`, payload: { mode, score: Number(r.score), commuteMinutes: r.commute == null ? null : Number(r.commute) } })))
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    created += inserted.length;
  }
  return created;
}
