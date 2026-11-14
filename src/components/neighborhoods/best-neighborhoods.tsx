import Link from "next/link";
import { ArrowRight, Award, MapPinned } from "lucide-react";
import { GRADE_CLASS } from "@/components/property/badges";
import { gradeOf } from "@/domain/evaluation";
import { brl, pctBp } from "@/domain/money";
import type { NeighborhoodStats } from "@/server/queries/neighborhoods";
import { cn } from "@/lib/utils";

const MIN_OFFERS = 3;

/**
 * Critical ranking: best places (risk + services, any price) and best markets (mean evaluation
 * of the offers in the mode, with at least 3 offers). Each card links to its search.
 */
export function BestNeighborhoods({ rows, mode }: { rows: NeighborhoodStats[]; mode: "aluguel" | "compra" }) {
  const buy = mode === "compra";
  const places = rows.filter((r) => r.place.score != null).sort((a, b) => b.place.score! - a.place.score! || b.count - a.count).slice(0, 5);
  const markets = rows.filter((r) => r.avgEval != null && r.count >= MIN_OFFERS).sort((a, b) => b.avgEval! - a.avgEval! || b.goodOffers - a.goodOffers).slice(0, 5);
  const link = (r: NeighborhoodStats) => `/?modo=${mode}&bairros=${encodeURIComponent(r.name)}&ordem=melhor_avaliacao`;
  const price = (r: NeighborhoodStats) => (buy ? `${brl(r.medianPriceM2Cents)}/m²${r.medianYieldBp != null ? ` · ${pctBp(r.medianYieldBp)} a.a.` : ""}` : `${brl(r.medianTotalCents)}/mês · ${brl(r.medianCostM2Cents)}/m²`);
  if (!places.length && !markets.length) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Ranking title="Melhores locais" icon={<MapPinned className="size-4 text-primary" />} subtitle="Risco médio dos imóveis analisados e serviços e transporte a 1 km do centro; não depende de preço.">
        {places.map((r, i) => (
          <Row key={r.key} i={i} href={link(r)} name={r.name} regional={r.regional} grade={r.place.grade!} score={r.place.score!} note={[...r.place.pros.slice(0, 2), ...r.place.cons.slice(0, 1).map((c) => `⚠ ${c}`)].join(" · ")} />
        ))}
      </Ranking>
      <Ranking title={buy ? "Melhores ofertas para comprar" : "Melhores ofertas para alugar"} icon={<Award className="size-4 text-primary" />} subtitle={`Avaliação média das ofertas do bairro (mínimo de ${MIN_OFFERS}): preço frente a parecidos, ${buy ? "rendimento" : "clareza dos custos"}, risco e serviços.`}>
        {markets.map((r, i) => (
          <Row key={r.key} i={i} href={link(r)} name={r.name} regional={r.regional} grade={gradeOf(r.avgEval!)} score={r.avgEval!} note={`${r.goodOffers} de ${r.count} com nota B ou melhor · ${price(r)}`} />
        ))}
      </Ranking>
    </div>
  );
}

function Ranking({ title, icon, subtitle, children }: { title: string; icon: React.ReactNode; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</h2>
      <p className="mb-2 text-xs text-muted-foreground">{subtitle}</p>
      <ol className="divide-y">{children}</ol>
    </section>
  );
}

function Row({ i, href, name, regional, grade, score, note }: { i: number; href: string; name: string; regional: string | null; grade: keyof typeof GRADE_CLASS; score: number; note: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 py-2 hover:text-primary">
        <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ring-1 ring-inset", GRADE_CLASS[grade])}>{grade}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{name} <span className="text-xs font-normal text-muted-foreground">· {regional ?? "Regional ?"} · {score}</span></span>
          <span className="block truncate text-xs text-muted-foreground">{note}</span>
        </span>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
