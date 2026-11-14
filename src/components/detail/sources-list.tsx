import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type ListingStatus } from "@/domain/lifecycle";
import { brl, m2 } from "@/domain/money";
import type { ListingRow } from "@/server/queries/property";
import { cn } from "@/lib/utils";

const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const STATUS_CLASS: Record<ListingStatus, string> = {
  ativo: "bg-positive/12 text-positive",
  possivelmente_indisponivel: "bg-amber-50 text-amber-700",
  indisponivel: "bg-muted text-muted-foreground",
};

/** Every listing of the property: source, price, link, advertiser, first seen, last verified, status. */
export function SourcesList({ listings }: { listings: ListingRow[] }) {
  const lowest = Math.min(...listings.filter((l) => l.status !== "indisponivel" && l.rentCents != null).map((l) => l.rentCents!));
  return (
    <ul className="divide-y rounded-xl border">
      {listings.map((l) => {
        const status = l.status as ListingStatus;
        const best = l.rentCents === lowest && listings.length > 1;
        return (
          <li key={l.id} className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{l.sourceName}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_CLASS[status])}>{STATUS_LABEL[status]}</span>
                {best && <Badge className="h-5 bg-positive text-white">Menor preço</Badge>}
                {l.sourceIsDemo && <Badge variant="outline" className="h-5 border-demo/40 text-demo">Fictício</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {l.advertiserName ?? "Anunciante não informado"}
                {l.advertiserType && ` · ${l.advertiserType === "proprietario" ? "direto com proprietário" : "imobiliária"}`} · {m2(l.areaM2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Identificado em {fmt(l.firstSeenAt)} · Última verificação {fmt(l.lastCheckedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
              {l.rentCents != null && <span className="text-base font-semibold tabular-nums">{brl(l.rentCents)}<span className="text-xs font-normal text-muted-foreground">/mês</span></span>}
              {l.salePriceCents != null && <span className="text-base font-semibold tabular-nums">{brl(l.salePriceCents)}<span className="text-xs font-normal text-muted-foreground"> venda</span></span>}
              {l.url ? (
                <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Anúncio original <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">{l.sourceIsDemo ? "Sem link (demonstração)" : "Fonte sem link público"}</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
