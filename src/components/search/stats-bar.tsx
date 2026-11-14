import { CalendarClock, Home, Ruler, Sparkle, TrendingDown, Wallet } from "lucide-react";
import { brl, m2, pctBp } from "@/domain/money";
import type { SearchStats } from "@/server/search";
import type { UpdateInfo } from "@/server/dashboard";

const dt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const time = new Intl.DateTimeFormat("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Home; label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-[150px] shrink-0 snap-start items-center gap-3 rounded-xl border bg-card px-3.5 py-2.5 shadow-xs sm:min-w-0 sm:shrink">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="truncate text-base leading-tight font-semibold tabular-nums">{value}</p>
        {hint && <p className="truncate text-[11px] text-muted-foreground" title={hint}>{hint}</p>}
      </div>
    </div>
  );
}

/** Totals of the filtered set (spec 2.1) and when the base was last updated. */
export function StatsBar({ stats, update, className, mode = "aluguel" }: { stats: SearchStats; update: UpdateInfo; className?: string; mode?: "aluguel" | "compra" }) {
  const last = update.lastRunAt ?? update.lastCheckedAt;
  return (
    <div className={`-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-6 ${className ?? ""}`}>
      <Stat icon={Home} label="Imóveis" value={stats.total.toLocaleString("pt-BR")} hint={stats.total ? `${stats.located.toLocaleString("pt-BR")} no mapa` : undefined} />
      {mode === "compra" ? (
        <>
          <Stat icon={Wallet} label="Preço médio" value={brl(stats.avgPriceCents)} hint={stats.medianPriceM2Cents != null ? `mediana ${brl(stats.medianPriceM2Cents)}/m²` : undefined} />
          <Stat icon={TrendingDown} label="Menor preço" value={brl(stats.minPriceCents)} hint={stats.avgYieldBp != null ? `rendimento médio ${pctBp(stats.avgYieldBp)} a.a.` : undefined} />
        </>
      ) : (
        <>
          <Stat icon={Wallet} label="Aluguel médio" value={brl(stats.avgRentCents)} />
          <Stat icon={TrendingDown} label="Menor aluguel" value={brl(stats.minRentCents)} hint={stats.minTotalCents != null ? `total a partir de ${brl(stats.minTotalCents)}` : undefined} />
        </>
      )}
      <Stat icon={Ruler} label="Área média" value={m2(stats.avgAreaM2)} />
      <Stat icon={Sparkle} label="Novos em 24 h" value={stats.new24h.toLocaleString("pt-BR")} />
      <Stat icon={CalendarClock} label="Atualizado em" value={last ? dt.format(last) : "—"} hint={`próxima: ${time.format(update.nextRunAt)}`} />
    </div>
  );
}
