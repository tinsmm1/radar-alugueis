import { TrendingDown, TrendingUp } from "lucide-react";
import { LineChart } from "@/components/charts/line-chart";
import { brl, brlCents, pctBp } from "@/domain/money";
import { dailyLowest, type ListingRow, type PricePoint } from "@/server/queries/property";

const date = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

/** Initial price, current price, last reduction and the full change list (all sources). */
export function PriceHistory({ history: all, listings, dropBp, droppedAt, mode = "aluguel" }: { history: PricePoint[]; listings: ListingRow[]; dropBp: number | null; droppedAt: Date | null; mode?: "aluguel" | "compra" }) {
  const buy = mode === "compra";
  // Buy mode charts the asking price; the rows keep condo and IPTU for context.
  const history = buy ? all.filter((h) => h.salePriceCents != null).map((h) => ({ ...h, rentCents: h.salePriceCents ?? null, totalCents: h.salePriceCents ?? null })) : all.filter((h) => h.rentCents != null);
  const series = dailyLowest(history);
  const initial = series[0]?.rentCents ?? null;
  const current = series.at(-1)?.rentCents ?? null;
  const variation = initial && current != null && initial !== current ? Math.round(((current - initial) / initial) * 10_000) : null;
  const source = new Map(listings.map((l) => [l.id, l.sourceName]));
  const changes = [...history].reverse();
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-muted/60 p-3">
          <dt className="text-xs text-muted-foreground">Preço inicial identificado</dt>
          <dd className="font-semibold tabular-nums">{brl(initial)}</dd>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <dt className="text-xs text-muted-foreground">Preço atual (menor)</dt>
          <dd className="font-semibold tabular-nums">{brl(current)}</dd>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <dt className="text-xs text-muted-foreground">Última redução</dt>
          <dd className="font-semibold">{droppedAt && dropBp ? date(droppedAt) : "Nenhuma"}</dd>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <dt className="text-xs text-muted-foreground">Variação desde o início</dt>
          <dd className={variation != null && variation < 0 ? "inline-flex items-center gap-1 font-semibold text-positive" : "inline-flex items-center gap-1 font-semibold"}>
            {variation == null ? "Sem alteração" : (
              <>
                {variation < 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
                {variation < 0 ? "−" : "+"}
                {pctBp(Math.abs(variation))}
              </>
            )}
          </dd>
        </div>
      </dl>
      {series.length > 1 && <LineChart points={series.map((s) => ({ at: s.at, value: s.rentCents }))} format={(v) => brl(Math.round(v))} label={buy ? "Histórico do menor preço de venda anunciado" : "Histórico do menor aluguel anunciado"} />}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Data</th>
              <th className="px-3 py-2 text-left font-medium">Fonte</th>
              <th className="px-3 py-2 text-right font-medium">{buy ? "Preço de venda" : "Aluguel"}</th>
              <th className="px-3 py-2 text-right font-medium">Condomínio</th>
              {!buy && <th className="px-3 py-2 text-right font-medium">Total conhecido</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {changes.map((h, i) => (
              <tr key={i}>
                <td className="px-3 py-2 whitespace-nowrap">{date(h.observedAt)}</td>
                <td className="px-3 py-2 text-muted-foreground">{source.get(h.listingId) ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brl(h.rentCents)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{h.condoCents == null ? "não inf." : brl(h.condoCents)}</td>
                {!buy && <td className="px-3 py-2 text-right tabular-nums">{brlCents(h.totalCents)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
