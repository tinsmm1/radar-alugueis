import Link from "next/link";
import { Award, Clock, Info, Percent, Ruler, Search, Sparkles, TrendingDown } from "lucide-react";
import { SaveSearchDialog } from "@/components/search/save-search-dialog";
import { EMPTY_FILTER, searchHref, type Filter } from "@/domain/filters";
import { PropertyCardView } from "@/components/property/card";
import { BELOW_MARKET, MIN_COMPARABLES, RECENT_HOURS, type OpportunitySignal } from "@/domain/opportunity";
import { brl, pctBp } from "@/domain/money";
import { favoriteIds } from "@/server/favorites";
import { opportunityCounts, opportunityList, type OpportunityTab } from "@/server/queries/opportunities";
import { cn } from "@/lib/utils";
import { requireAuth } from "@/auth/session";
import { currentMode } from "@/server/mode";

export const metadata = { title: "Oportunidades" };

type Tab = { key: OpportunityTab; label: string; icon: typeof Sparkles; help: string };

const BUY_TABS: Tab[] = [
  { key: "melhores", label: "Melhores avaliados", icon: Award, help: "Nota B ou melhor na avaliação do Radar, que pesa preço frente a imóveis parecidos (40 pontos), rendimento estimado (10), risco da localização (25), serviços e transporte por perto (15) e o imóvel e seus dados (10). Dados que faltam contam como neutros e reduzem a confiança." },
  { key: "abaixo", label: "Abaixo dos comparáveis", icon: Sparkles, help: `Preço por m² pelo menos ${Math.round(BELOW_MARKET * 100)}% abaixo da mediana de imóveis à venda comparáveis (mesmo bairro, ou a regional, mesmo grupo de tipo e faixa de quartos), com ${MIN_COMPARABLES} ou mais comparáveis.` },
  { key: "rendimento", label: "Maior rendimento", icon: Percent, help: "Rendimento bruto estimado: aluguel estimado × 12 ÷ preço. O aluguel vem da mediana do aluguel por m² de imóveis comparáveis para alugar. Não desconta impostos, vacância nem custos." },
  { key: "reducao", label: "Preço reduzido", icon: TrendingDown, help: "Preço de venda reduzido em pelo menos 1% nos últimos 30 dias, segundo o histórico coletado." },
  { key: "recentes", label: "Recém-publicados", icon: Clock, help: `Identificados pela primeira vez nas últimas ${RECENT_HOURS} horas.` },
  { key: "m2", label: "Menor preço por m²", icon: Ruler, help: "Ranking pelo preço de venda dividido pela área privativa." },
];

const TABS: Tab[] = [
  { key: "melhores", label: "Melhores avaliados", icon: Award, help: "Nota B ou melhor na avaliação do Radar, que pesa preço frente a imóveis parecidos (40 pontos), clareza do custo mensal (10), risco da localização (25), serviços e transporte por perto (15) e o imóvel e seus dados (10). Dados que faltam contam como neutros e reduzem a confiança." },
  { key: "abaixo", label: "Abaixo dos comparáveis", icon: Sparkles, help: `Custo total por m² pelo menos ${Math.round(BELOW_MARKET * 100)}% abaixo da mediana de imóveis comparáveis (mesmo bairro, ou a regional quando o bairro tem poucos, mesmo grupo de tipo e faixa de quartos). Só vale com ${MIN_COMPARABLES} ou mais comparáveis; o próprio imóvel não entra na conta.` },
  { key: "reducao", label: "Preço reduzido", icon: TrendingDown, help: "Aluguel reduzido em pelo menos 1% nos últimos 30 dias, segundo o histórico de preços coletado." },
  { key: "recentes", label: "Recém-publicados", icon: Clock, help: `Identificados pela primeira vez nas últimas ${RECENT_HOURS} horas. Os melhores imóveis costumam sair rápido.` },
  { key: "m2", label: "Menor custo por m²", icon: Ruler, help: "Ranking pelo custo mensal total conhecido dividido pela área privativa. Revela imóveis baratos para o tamanho, que o aluguel sozinho esconde. Custos parciais aparecem marcados." },
];

/** The search behind each tab, to open it with every filter or to save it as an alert. */
function tabFilter(tab: OpportunityTab, mode: "aluguel" | "compra"): Filter {
  const base: Filter = { ...EMPTY_FILTER, modo: mode };
  switch (tab) {
    case "melhores": return { ...base, notaMin: "B", ordem: "melhor_avaliacao" };
    case "reducao": return { ...base, reducao: true, ordem: "maior_reducao" };
    case "recentes": return { ...base, recentesDias: 3, ordem: "recentes" };
    case "rendimento": return { ...base, rendimentoMin: 6, ordem: "maior_rendimento" };
    case "m2": return { ...base, ordem: mode === "compra" ? "menor_preco_m2" : "menor_m2" };
    default: return { ...base, oportunidades: true, ordem: "oportunidade" };
  }
}

function signalNote(data: unknown, buy = false): string | null {
  const signals = (data as { signals?: OpportunitySignal[] } | null)?.signals ?? [];
  const below = signals.find((s) => s.kind === "abaixo_mercado");
  const drop = signals.find((s) => s.kind === "baixa_preco");
  const parts = [
    below && below.kind === "abaixo_mercado" && `${buy ? "preço/m² " : ""}${below.pctBelow.toLocaleString("pt-BR")}% abaixo da mediana de ${brl(below.medianCostPerM2)}/m² (${below.comparables} comparáveis no ${below.scope === "bairro" ? "bairro" : "regional"})`,
    drop && drop.kind === "baixa_preco" && `redução de ${pctBp(drop.dropBp)} em ${new Date(drop.at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export default async function OpportunitiesPage({ searchParams }: PageProps<"/oportunidades">) {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const sp = await searchParams;
  const mode = await currentMode(sp.modo);
  const buy = mode === "compra";
  const list = buy ? BUY_TABS : TABS;
  const tab = (list.find((t) => t.key === sp.tab)?.key ?? "melhores") as OpportunityTab;
  const search = tabFilter(tab, mode);
  const [items, counts] = await Promise.all([opportunityList(tab, mode), opportunityCounts(mode)]);
  const favs = await favoriteIds(items.map((i) => i.id));
  const current = list.find((t) => t.key === tab)!;
  const hasDemo = items.some((i) => i.isDemo);
  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Detector de oportunidades</h1>
        <p className="text-sm text-muted-foreground">
          {buy ? "Imóveis à venda que merecem atenção: preço por m² abaixo de imóveis parecidos, alto rendimento estimado, preço caindo e anúncios novos." : "Imóveis para alugar que merecem atenção agora: preço caindo, custo abaixo de imóveis parecidos e anúncios novos."}
        </p>
      </div>
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Tipos de oportunidade">
        {list.map(({ key, label, icon: Icon }) => (
          <Link key={key} href={`/oportunidades?tab=${key}&modo=${mode}`} aria-current={key === tab ? "page" : undefined} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", key === tab && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground")}>
            <Icon className="size-4" />
            {label}
            <span className={cn("rounded-full bg-muted px-1.5 text-xs text-muted-foreground", key === tab && "bg-white/20 text-primary-foreground")}>{counts[key]}</span>
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <SaveSearchDialog preset={search} label="Criar alerta para esta categoria" variant="outline" />
        <Link href={searchHref(search)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary hover:bg-accent">
          <Search className="size-4" />
          Abrir na busca, com mapa e filtros
        </Link>
      </div>
      <p className="flex gap-2 rounded-xl border bg-accent/40 p-3.5 text-sm text-accent-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          <b>Como funciona:</b> {current.help}
          {hasDemo && " Dados de demonstração são comparados só entre si, nunca com anúncios reais."}
        </span>
      </p>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center text-sm text-muted-foreground">Nenhum imóvel nesta categoria agora. As oportunidades são recalculadas a cada coleta (06h e 18h).</div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p, i) => {
            const note = signalNote(buy ? p.saleOpportunity : p.opportunity, buy);
            return (
              <li key={p.id} className="space-y-1.5">
                {tab === "m2" && !buy && <p className="text-xs font-medium text-muted-foreground">#{i + 1} · {brl(p.costPerM2Cents)}/m²{p.costStatus !== "completo" && " (custo parcial)"}</p>}
                {tab === "m2" && buy && <p className="text-xs font-medium text-muted-foreground">#{i + 1} · {brl(p.salePriceM2Cents)}/m²</p>}
                {tab === "rendimento" && <p className="text-xs font-medium text-muted-foreground">#{i + 1} · {pctBp(p.grossYieldBp)} a.a. · aluguel estimado {brl(p.estRentCents)}/mês</p>}
                <PropertyCardView p={p} favorite={favs.has(p.id)} mode={mode} />
                {note && tab !== "m2" && tab !== "rendimento" && <p className="px-1 text-xs text-muted-foreground">{note}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
