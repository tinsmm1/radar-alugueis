import Link from "next/link";
import { Star } from "lucide-react";
import { GRADE_CLASS } from "@/components/property/badges";
import { brl, pctBp } from "@/domain/money";
import type { RegionStats } from "@/domain/regions";
import { cn } from "@/lib/utils";

/** Region comparison table (regional or neighbourhood): grade, price spread, commute, yield, offers and risk. */
export function RegionTable({ rows, kind, mode, hasCommute }: { rows: RegionStats[]; kind: "regional" | "bairro"; mode: "aluguel" | "compra"; hasCommute: boolean }) {
  const buy = mode === "compra";
  if (!rows.length) return <p className="text-sm text-muted-foreground">Ainda não há imóveis suficientes para comparar.</p>;
  const href = (r: RegionStats) => `/?modo=${mode}&${kind === "regional" ? "regionais" : "bairros"}=${encodeURIComponent(r.area)}&ordem=melhor_avaliacao`;
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{kind === "regional" ? "Regional" : "Bairro"}</th>
            <th className="px-3 py-2 font-medium">Nota</th>
            <th className="px-3 py-2 font-medium">{buy ? "Preço/m² (mediana)" : "Custo/m² (mediana)"}</th>
            <th className="px-3 py-2 font-medium">Faixa (25%–75%)</th>
            {hasCommute && <th className="px-3 py-2 font-medium">Até o trabalho</th>}
            {buy && <th className="px-3 py-2 font-medium">Rendimento</th>}
            <th className="px-3 py-2 font-medium">Ofertas B+</th>
            <th className="px-3 py-2 font-medium">Inundação</th>
            <th className="px-3 py-2 font-medium">Leitura</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.area} className={cn(r.frontier && "bg-emerald-50/60")}>
              <td className="px-3 py-2 font-medium">
                <Link href={href(r)} className="hover:text-primary hover:underline">{r.area}</Link>
                {r.frontier && <Star className="ml-1 inline size-3.5 fill-emerald-500 text-emerald-600" aria-label="Melhor posição" />}
                <span className="block text-xs font-normal text-muted-foreground">{r.count} imóveis</span>
              </td>
              <td className="px-3 py-2">{r.grade ? <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-xs font-bold ring-1 ring-inset", GRADE_CLASS[r.grade])}>{r.grade} · {r.score}</span> : <span className="text-xs text-muted-foreground">amostra pequena</span>}</td>
              <td className="px-3 py-2 tabular-nums">{brl(r.medianPriceM2Cents)}</td>
              <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{r.p25PriceM2Cents != null ? `${brl(r.p25PriceM2Cents)} – ${brl(r.p75PriceM2Cents)}` : "—"}</td>
              {hasCommute && <td className="px-3 py-2 tabular-nums">{r.medianCommuteMin != null ? `${Math.round(r.medianCommuteMin)} min` : "—"}</td>}
              {buy && <td className="px-3 py-2 tabular-nums">{r.medianYieldBp != null ? pctBp(r.medianYieldBp) : "—"}</td>}
              <td className="px-3 py-2 tabular-nums">{r.goodOffers}</td>
              <td className="px-3 py-2 tabular-nums">{r.floodPct != null ? `${r.floodPct}%` : "sem dados"}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{[...r.pros, ...r.cons].slice(0, 3).join(" · ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
