import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FlaskConical, MapPin, Copy } from "lucide-react";
import { CostStatusBadge, DemoBadge, DropBadge, OpportunityBadges, PrecisionBadge, RiskBadge } from "@/components/property/badges";
import { CompareButton } from "@/components/property/compare-button";
import { FavoriteButton } from "@/components/property/favorite-button";
import { CostBreakdown } from "@/components/detail/cost-breakdown";
import { FactsGrid } from "@/components/detail/facts-grid";
import { Gallery } from "@/components/detail/gallery";
import { LocationAnalysis } from "@/components/detail/location-analysis";
import { MiniMap } from "@/components/detail/mini-map";
import { PriceHistory } from "@/components/detail/price-history";
import { SaveToList } from "@/components/detail/save-to-list";
import { SourcesList } from "@/components/detail/sources-list";
import { TYPE_LABEL, type IptuPeriod, type PropertyType } from "@/domain/listing";
import { brl, m2 } from "@/domain/money";
import { STATUS_LABEL, type ListingStatus } from "@/domain/lifecycle";
import { lists } from "@/server/favorites";
import { getPropertyDetail } from "@/server/queries/property";
import { isAuthenticated, requireAuth } from "@/auth/session";
import { FinancingSimulator } from "@/components/detail/financing-simulator";
import { PurchasePanel, type RentEstimate } from "@/components/detail/purchase-panel";
import { currentMode } from "@/server/mode";
import { EvaluationPanel } from "@/components/detail/evaluation-panel";
import { PriceWatch } from "@/components/detail/price-watch";
import { RelatedLinks } from "@/components/detail/related-links";
import { GradeBadge } from "@/components/property/badges";
import { PropertyCardView } from "@/components/property/card";
import type { Evaluation } from "@/domain/evaluation";
import { favoriteIds } from "@/server/favorites";
import { similarProperties } from "@/server/queries/property";
import { watchesFor } from "@/server/queries/watches";
import { CommutePanel } from "@/components/detail/commute-panel";
import { DecisionPanel } from "@/components/detail/decision-panel";
import { buyAffordability } from "@/domain/affordability";
import type { CommuteSummary } from "@/domain/commute";
import { locatedWorkplaces } from "@/domain/profile";
import { quickCommute } from "@/server/commute/refresh";
import { getProfile } from "@/server/profile";

function Section({ id, title, children, aside }: { id: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const cleanTitle = (t: string | null) => t?.replace(/^\[DEMONSTRAÇÃO\]\s*/, "") ?? null;

export async function generateMetadata({ params }: PageProps<"/imovel/[id]">): Promise<Metadata> {
  if (!(await isAuthenticated())) return { title: "Imóvel" };
  const d = await getPropertyDetail(Number((await params).id));
  return { title: d ? (cleanTitle(d.property.title) ?? "Imóvel") : "Imóvel não encontrado" };
}

export default async function PropertyPage({ params, searchParams }: PageProps<"/imovel/[id]">) {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const id = Number((await params).id);
  const [d, myLists] = await Promise.all([getPropertyDetail(id), lists()]);
  if (!d) notFound();
  const p = d.property;
  // The view follows the hub mode, unless the property is offered only in the other one.
  const wanted = await currentMode((await searchParams).modo);
  const buy = wanted === "compra" ? p.forSale || !p.forRent : !p.forRent && p.forSale;
  const saleData = (p.saleOpportunity ?? null) as { rentEstimate?: RentEstimate } | null;
  const mode = buy ? "compra" : "aluguel";
  const [watches, similar, profile] = await Promise.all([watchesFor(p.id), similarProperties(p, mode), getProfile()]);
  const hasProfile = locatedWorkplaces(profile).length > 0;
  const storedCommute = hasProfile ? ((p.commute ?? null) as CommuteSummary | null) : null;
  const commute = storedCommute ?? (hasProfile && p.lat != null && p.lng != null ? quickCommute(profile, { lat: p.lat, lng: p.lng }) : null);
  const housingMonthly = buy ? (p.salePriceCents != null ? buyAffordability(p.salePriceCents, p.condoCents, p.iptuMonthlyCents, profile).housingMonthlyCents : null) : (p.totalCents ?? p.rentCents);
  const similarFavs = await favoriteIds(similar.map((s) => s.id));
  const evaluation = ((buy ? p.saleEval : p.rentEval) ?? null) as Evaluation | null;
  const canonical = d.listings.find((l) => l.status !== "indisponivel" && l.rentCents != null && l.rentCents === p.rentCents) ?? d.listings[0];
  const title = cleanTitle(p.title) ?? (p.type ? TYPE_LABEL[p.type as PropertyType] : "Imóvel");
  const photos = [...new Set(d.listings.flatMap((l) => l.photos))];
  const approximate = p.geoPrecision !== "exata";
  const address = p.street && !canonical?.addressHidden ? [p.street, p.number].filter(Boolean).join(", ") : null;
  const descriptions = [...new Set(d.listings.map((l) => l.description).filter((x): x is string => Boolean(x)))];
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 lg:px-6">
      <Link href={`/?modo=${mode}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar à busca
      </Link>
      {p.isDemo && (
        <div className="flex gap-3 rounded-xl border border-demo/30 bg-demo/8 p-4 text-sm">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-demo" />
          <p>
            <b className="text-demo">Dado de demonstração.</b> Este anúncio é fictício, gerado só para mostrar a interface: não está disponível para aluguel nem para venda. A análise da localização usa camadas reais para o ponto sorteado.
          </p>
        </div>
      )}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {p.isDemo && <DemoBadge />}
          <GradeBadge score={buy ? p.saleEvalScore : p.rentEvalScore} long />
          <RiskBadge level={p.riskLevel} score={p.riskScore} />
          <DropBadge dropBp={buy ? p.saleDropBp : p.dropBp} />
          <OpportunityBadges data={buy ? p.saleOpportunity : p.opportunity} max={3} />
          {!buy && <CostStatusBadge status={p.costStatus} />}
          <PrecisionBadge precision={p.geoPrecision} />
          {p.status !== "ativo" && <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white">{STATUS_LABEL[p.status as ListingStatus]}</span>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {p.forRent && p.forSale && (
          <div className="inline-flex rounded-lg border bg-muted/60 p-0.5 text-sm" role="tablist" aria-label="Ver este imóvel como">
            <Link href={`/imovel/${p.id}?modo=aluguel`} role="tab" aria-selected={!buy} className={!buy ? "rounded-md bg-card px-3 py-1 font-medium shadow-xs" : "px-3 py-1 text-muted-foreground"}>Para alugar · {brl(p.totalCents)}/mês</Link>
            <Link href={`/imovel/${p.id}?modo=compra`} role="tab" aria-selected={buy} className={buy ? "rounded-md bg-card px-3 py-1 font-medium shadow-xs" : "px-3 py-1 text-muted-foreground"}>À venda · {brl(p.salePriceCents)}</Link>
          </div>
        )}
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          {[address ?? "Endereço não divulgado pela fonte (localização aproximada)", p.neighborhood, p.regional && `Regional ${p.regional}`, "Belo Horizonte"].filter(Boolean).join(" · ")}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Gallery photos={photos} title={title} />
          <Section id="avaliacao" title={`Avaliação do Radar · ${buy ? "compra" : "aluguel"}`}>
            <EvaluationPanel evaluation={evaluation} mode={mode} />
          </Section>
          <Section id="deslocamento" title="Deslocamento até o trabalho">
            <CommutePanel summary={commute} quick={hasProfile && !storedCommute && commute != null} hasProfile={hasProfile} maxCommuteMin={profile.maxCommuteMin} housingMonthlyCents={housingMonthly} housingLabel={buy ? "parcela SAC + condomínio + IPTU" : "custo mensal conhecido"} />
          </Section>
          <Section id="decisao" title="Negociação e decisão">
            <DecisionPanel mode={mode} negotiation={evaluation?.negotiation ?? null} profile={profile} priceCents={p.salePriceCents} condoCents={p.condoCents} iptuMonthlyCents={p.iptuMonthlyCents} totalCents={p.totalCents} commuteCostCents={commute?.monthlyCostCents ?? null} />
          </Section>
          <Section id="ficha" title="Ficha do imóvel">
            <FactsGrid p={p} />
          </Section>
          {descriptions.length > 0 && (
            <Section id="descricao" title="Descrição original">
              <div className="space-y-3">
                {descriptions.map((t, i) => (
                  <p key={i} className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{t}</p>
                ))}
              </div>
            </Section>
          )}
          {buy && p.salePriceCents != null && (
            <Section id="simulacao" title="Simulação de compra">
              <FinancingSimulator priceCents={p.salePriceCents} condoCents={p.condoCents} iptuMonthlyCents={p.iptuMonthlyCents} estRentCents={p.estRentCents} />
            </Section>
          )}
          <Section id="analise" title="Análise da localização">
            <LocationAnalysis facts={d.facts} analyzedAt={p.analyzedAt} />
          </Section>
          <Section id="historico" title="Histórico de preços">
            <PriceHistory history={d.history} listings={d.listings} dropBp={buy ? p.saleDropBp : p.dropBp} droppedAt={buy ? p.saleDroppedAt : p.droppedAt} mode={buy ? "compra" : "aluguel"} />
          </Section>
          <Section id="fontes" title={`Onde está anunciado (${d.listings.length})`} aside={<span className="text-xs text-muted-foreground">Menor preço: {buy ? brl(p.salePriceCents) : `${brl(p.rentCents)}/mês`}</span>}>
            <SourcesList listings={d.listings} />
            {d.listings.length > 1 && <p className="mt-2 text-xs text-muted-foreground">Anúncios agrupados por endereço, área, quartos, preço e texto. Confira os detalhes em cada fonte.</p>}
          </Section>
          {similar.length > 0 && (
            <Section id="parecidos" title="Imóveis parecidos, melhor avaliados primeiro">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {similar.map((s) => <PropertyCardView key={s.id} p={s} favorite={similarFavs.has(s.id)} mode={mode} compact />)}
              </div>
            </Section>
          )}
          {d.duplicates.length > 0 && (
            <Section id="duplicados" title="Possível mesmo imóvel">
              <p className="mb-3 text-sm text-muted-foreground">Anúncios parecidos que não foram agrupados por falta de evidência suficiente. Podem ser o mesmo imóvel ou vizinhos parecidos.</p>
              <ul className="divide-y rounded-xl border">
                {d.duplicates.map((x) => (
                  <li key={x.otherListingId} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Copy className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{cleanTitle(x.title) ?? "Anúncio"} · {x.sourceName} · {m2(x.areaM2)} · {brl(x.rentCents)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-muted-foreground">semelhança {Math.round(x.score * 100)}%</span>
                      {x.otherPropertyId && <Link href={`/imovel/${x.otherPropertyId}`} className="text-xs font-medium text-primary hover:underline">Abrir</Link>}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            {buy ? (
              <PurchasePanel priceCents={p.salePriceCents} priceM2Cents={p.salePriceM2Cents} condoCents={p.condoCents} iptuMonthlyCents={p.iptuMonthlyCents} estRentCents={p.estRentCents} yieldBp={p.grossYieldBp} estimate={saleData?.rentEstimate ?? null} />
            ) : (
              <CostBreakdown
                input={{ rentCents: canonical?.rentCents ?? p.rentCents, condoCents: canonical?.condoCents ?? null, iptuCents: canonical?.iptuCents ?? null, iptuPeriod: (canonical?.iptuPeriod as IptuPeriod | null) ?? null, otherFeesCents: canonical?.otherFeesCents ?? null }}
                areaM2={p.areaM2}
                iptuRaw={canonical?.iptuCents ?? null}
              />
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <FavoriteButton id={p.id} initial={d.favoriteIn.length > 0} size="sm" />
              <SaveToList propertyId={p.id} lists={myLists} inLists={d.favoriteIn} />
              <CompareButton id={p.id} size="sm" />
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Primeira identificação {p.firstSeenAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · Última verificação {p.lastSeenAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
            </p>
          </div>
          {(buy ? p.forSale : p.forRent) && p.status !== "indisponivel" && (
            <PriceWatch propertyId={p.id} mode={mode} currentCents={buy ? p.salePriceCents : (p.totalCents ?? p.rentCents)} watch={watches.find((w) => w.mode === mode) ?? null} />
          )}
          <RelatedLinks p={p} mode={mode} />
          {p.lat != null && p.lng != null ? (
            <div className="space-y-2">
              <MiniMap lat={p.lat} lng={p.lng} approximate={approximate} />
              <p className="text-xs text-muted-foreground">{approximate ? "Círculo: localização aproximada (centro do bairro ou endereço oculto pela fonte)." : "Posição do endereço informado."}</p>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Ainda sem localização no mapa: o endereço será geocodificado na próxima coleta.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
