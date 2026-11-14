import Link from "next/link";
import { Bath, BedDouble, Car, Clock, Home, Ruler } from "lucide-react";
import { FEATURE_LABEL, TYPE_LABEL, type Feature, type Mode, type PropertyType } from "@/domain/listing";
import { brl, m2, pctBp } from "@/domain/money";
import { STATUS_LABEL, type ListingStatus } from "@/domain/lifecycle";
import type { PropertyCard } from "@/server/search";
import { cn } from "@/lib/utils";
import { GradeBadge, CostStatusBadge, DemoBadge, DropBadge, OpportunityBadges, PrecisionBadge, RiskBadge, SourceBadges } from "./badges";
import { CompareButton } from "./compare-button";
import { FavoriteButton } from "./favorite-button";

export function relativeTime(d: Date | string | null): string {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "há menos de 1 h";
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

export function Photo({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-accent to-muted text-primary/40", className)} aria-hidden>
        <Home className="size-10" />
      </div>
    );
  }
  // Listing photos come from the advertisers' own hosts (any domain), so next/image is not used.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={cn("object-cover", className)} />;
}

/**
 * Property card: photo, title, neighbourhood, rent, condo, IPTU, known monthly total, area,
 * rooms, features, sources and last check. Pure markup (works in server and client trees);
 * list/map selection behaviour is added by the caller around it.
 */
export function PropertyCardView({ p, favorite, selected, compact, mode: wanted }: { p: PropertyCard; favorite: boolean; selected?: boolean; compact?: boolean; mode?: Mode }) {
  // Show the deal of the current mode; a property offered only in the other mode shows that one.
  const mode: Mode = wanted === "compra" ? (p.forSale ? "compra" : "aluguel") : p.forRent || !p.forSale ? "aluguel" : "compra";
  const buy = mode === "compra";
  const title = p.title?.replace(/^\[DEMONSTRAÇÃO\]\s*/, "") || (p.type ? TYPE_LABEL[p.type as PropertyType] : "Imóvel");
  const unavailable = p.status !== "ativo";
  return (
    <article className={cn("group relative overflow-hidden rounded-xl border bg-card shadow-xs transition-all hover:-translate-y-px hover:shadow-md", selected && "border-primary ring-2 ring-primary/30", unavailable && "opacity-75")}>
      <Link href={`/imovel/${p.id}?modo=${mode}`} className="absolute inset-0 z-10" aria-label={`${title}, ${p.neighborhood ?? ""}`} />
      <div className={cn("relative", compact ? "aspect-[16/9]" : "aspect-[16/10]")}>
        <Photo src={p.photo} alt={title} className="size-full" />
        <div className="absolute top-2 right-20 left-2 flex flex-wrap gap-1">
          {p.isDemo && <DemoBadge className="bg-white/95" />}
          <DropBadge dropBp={buy ? p.saleDropBp : p.dropBp} className="bg-white/95" />
          {unavailable && <span className="rounded-full bg-zinc-900/80 px-2 py-0.5 text-[11px] font-medium text-white">{STATUS_LABEL[p.status as ListingStatus]}</span>}
        </div>
        <div className="absolute top-2 right-2 z-20 flex gap-1.5">
          <FavoriteButton id={p.id} initial={favorite} className="bg-white/95 shadow-sm" />
          <CompareButton id={p.id} className="shadow-sm" />
        </div>
      </div>
      <div className="space-y-2.5 p-3.5">
        <div>
          {buy ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg leading-tight font-semibold tracking-tight">{brl(p.salePriceCents)}</p>
                {p.salePriceM2Cents != null && <span className="text-xs text-muted-foreground">{brl(p.salePriceM2Cents)}/m²</span>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cond. {p.condoCents == null ? "não inf." : brl(p.condoCents)} · IPTU {p.iptuMonthlyCents == null ? "não inf." : `${brl(p.iptuMonthlyCents)}/mês`}
                {p.grossYieldBp != null && <> · Aluguel est. {brl(p.estRentCents)} · <span className="font-medium text-foreground/80">{pctBp(p.grossYieldBp)} a.a.</span></>}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg leading-tight font-semibold tracking-tight">
                  {brl(p.totalCents)}
                  <span className="text-xs font-normal text-muted-foreground">/mês</span>
                </p>
                {p.costPerM2Cents != null && <span className="text-xs text-muted-foreground">{brl(p.costPerM2Cents)}/m²</span>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Aluguel {brl(p.rentCents)} · Cond. {p.condoCents == null ? "não inf." : brl(p.condoCents)} · IPTU {p.iptuMonthlyCents == null ? "não inf." : `${brl(p.iptuMonthlyCents)}/mês`}
              </p>
            </>
          )}
        </div>
        <div>
          <h3 className="line-clamp-1 text-sm font-medium">{title}</h3>
          <p className="line-clamp-1 text-xs text-muted-foreground">{[p.neighborhood, p.regional && `Regional ${p.regional}`].filter(Boolean).join(" · ") || "Bairro não informado"}</p>
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/80">
          <li className="inline-flex items-center gap-1"><Ruler className="size-3.5 text-muted-foreground" />{m2(p.areaM2)}</li>
          <li className="inline-flex items-center gap-1"><BedDouble className="size-3.5 text-muted-foreground" />{p.bedrooms ?? "—"} qto{p.suites ? ` (${p.suites} suíte)` : ""}</li>
          <li className="inline-flex items-center gap-1"><Bath className="size-3.5 text-muted-foreground" />{p.bathrooms ?? "—"}</li>
          <li className="inline-flex items-center gap-1"><Car className="size-3.5 text-muted-foreground" />{p.parking ?? "—"}</li>
        </ul>
        {!compact && p.features.length > 0 && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{p.features.slice(0, 4).map((f) => FEATURE_LABEL[f as Feature] ?? f).join(" · ")}{p.features.length > 4 ? ` +${p.features.length - 4}` : ""}</p>
        )}
        <div className="flex flex-wrap items-center gap-1">
          <GradeBadge score={buy ? p.saleEvalScore : p.rentEvalScore} />
          <RiskBadge level={p.riskLevel} score={p.riskScore} />
          {!buy && <CostStatusBadge status={p.costStatus} />}
          <OpportunityBadges data={buy ? p.saleOpportunity : p.opportunity} max={compact ? 1 : 2} />
          {p.forRent && p.forSale && <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border ring-inset">{buy ? "Também para alugar" : "Também à venda"}</span>}
          <PrecisionBadge precision={p.geoPrecision} />
        </div>
        <div className="flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
          <span className="flex min-w-0 flex-wrap gap-1"><SourceBadges keys={p.sourceKeys} />{(p.listingCount ?? 0) > 1 && <span>{p.listingCount} anúncios</span>}</span>
          <span className="inline-flex shrink-0 items-center gap-1"><Clock className="size-3" />{relativeTime(p.lastSeenAt)}</span>
        </div>
      </div>
    </article>
  );
}
