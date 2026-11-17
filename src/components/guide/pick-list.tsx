import Link from "next/link";
import { Briefcase, FlaskConical } from "lucide-react";
import { GRADE_CLASS, RiskBadge } from "@/components/property/badges";
import { Photo } from "@/components/property/card";
import { gradeOf } from "@/domain/evaluation";
import { brl, m2, pctBp } from "@/domain/money";
import type { GuidePick } from "@/server/queries/guide";
import { cn } from "@/lib/utils";

/** Ranked offers with the facts that matter for the decision and the top reasons. */
export function PickList({ picks, mode, empty }: { picks: GuidePick[]; mode: "aluguel" | "compra"; empty: string }) {
  if (!picks.length) return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{empty}</p>;
  const buy = mode === "compra";
  return (
    <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {picks.map((p, i) => {
        const grade = p.score != null ? gradeOf(p.score) : null;
        const title = p.title?.replace(/^\[DEMONSTRAÇÃO\]\s*/, "") || "Imóvel";
        const why = p.evaluation?.pros.slice(0, 2) ?? [];
        const watch = p.evaluation?.cons[0];
        return (
          <li key={p.id} className="relative flex gap-3 rounded-xl border bg-card p-3 hover:shadow-sm">
            <Link href={`/imovel/${p.id}?modo=${mode}`} className="absolute inset-0 z-10" aria-label={`${i + 1}º: ${title}`} />
            <Photo src={p.photo} alt={title} className="size-20 shrink-0 rounded-lg" />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">{i + 1}º</span>
                {grade && <span className={cn("rounded-md px-1.5 py-px text-[11px] font-bold ring-1 ring-inset", GRADE_CLASS[grade])}>{grade} · {p.score}</span>}
                {p.isDemo && <FlaskConical className="size-3.5 text-demo" aria-label="Demonstração" />}
                <RiskBadge level={p.riskLevel} />
              </div>
              <p className="truncate text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">
                {brl(p.priceCents)}{buy ? "" : "/mês"} · {m2(p.areaM2)} · {p.bedrooms ?? "—"} qto · {p.neighborhood ?? "—"}
                {buy && p.yieldBp != null && <> · {pctBp(p.yieldBp)} a.a.</>}
                {p.commuteMinutes != null && <> · <Briefcase className="inline size-3" /> {p.commuteMinutes} min</>}
              </p>
              {why.length > 0 && <p className="line-clamp-2 text-xs text-emerald-800">{why.join(" ")}</p>}
              {watch && <p className="line-clamp-1 text-xs text-amber-800">Atenção: {watch}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
