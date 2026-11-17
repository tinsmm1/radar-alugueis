import Link from "next/link";
import { Briefcase, FlaskConical, MapPinned, Scale, Sparkles, Target, Wallet } from "lucide-react";
import { PickList } from "@/components/guide/pick-list";
import { RegionTable } from "@/components/guide/region-table";
import { brl } from "@/domain/money";
import { REGIONS_NOTE } from "@/domain/regions";
import { EVALUATION_NOTE } from "@/domain/evaluation";
import { guideData } from "@/server/queries/guide";
import { currentMode } from "@/server/mode";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Guia de decisão" };
export const dynamic = "force-dynamic";

function Step({ n, icon: Icon, title, description, children }: { n: number; icon: typeof Target; title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="scroll-mt-20 rounded-2xl border bg-card p-4 sm:p-5" id={`passo-${n}`}>
      <div className="mb-4 flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{n}</span>
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold"><Icon className="size-4 text-primary" /> {title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Decision guide: from the owner's profile to a short list. 1) your profile and limits;
 * 2) which regionais to look at; 3) best positions among neighbourhoods; 4) the best offers
 * for you (within commute and budget) and overall; 5) how to close safely.
 */
export default async function GuidePage({ searchParams }: PageProps<"/guia">) {
  await requireAuth();
  const mode = await currentMode((await searchParams).modo);
  const buy = mode === "compra";
  const g = await guideData(mode);
  const frontier = g.bairros.filter((b) => b.frontier);
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Guia de decisão · {buy ? "comprar" : "alugar"}</h1>
        <p className="text-sm text-muted-foreground">Do seu perfil a uma lista curta: onde procurar, quais imóveis valem a visita e como fechar bem. Baseado em {g.total} imóveis ativos {buy ? "à venda" : "para alugar"} no Radar.</p>
      </div>
      {g.demo && g.total > 0 && (
        <p className="flex gap-2 rounded-xl border border-demo/30 bg-demo/8 p-3.5 text-sm"><FlaskConical className="mt-0.5 size-4 shrink-0 text-demo" /><span><b className="text-demo">Sem anúncios reais ainda:</b> o guia abaixo usa os dados de demonstração para mostrar como funciona.</span></p>
      )}

      <Step n={1} icon={Target} title="Seu perfil e seus limites" description="O que o Radar usa para personalizar notas, tempos e o que cabe no bolso.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Briefcase className="size-3.5" /> Trabalho e estudo</p>
            <p className="text-sm font-medium">{g.hasWorkplaces ? `${g.workplaces} local(is) · até ${g.maxCommuteMin} min só ida` : "Nenhum local cadastrado"}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="size-3.5" /> {buy ? "Preço máximo hoje" : "Orçamento"}</p>
            <p className="text-sm font-medium">{buy ? (g.maxPriceCents != null ? `${brl(g.maxPriceCents)} (limitado pela ${g.limitedBy})` : "Informe renda e reserva") : g.rentBudgetCents != null ? `até ${brl(g.rentBudgetCents)}/mês de custo total` : "Informe a renda no perfil"}</p>
          </div>
          <div className="flex items-center rounded-xl border border-dashed p-3 text-sm">
            <Link href="/admin/perfil" className="font-medium text-primary hover:underline">Editar perfil, horários e pesos da nota →</Link>
          </div>
        </div>
      </Step>

      <Step n={2} icon={MapPinned} title="Onde procurar: regionais comparadas" description={REGIONS_NOTE}>
        <RegionTable rows={g.regionais} kind="regional" mode={mode} hasCommute={g.hasWorkplaces} />
      </Step>

      <Step n={3} icon={Scale} title="Melhores posições entre os bairros" description={g.hasWorkplaces ? "A estrela marca bairros que nenhum outro supera ao mesmo tempo em preço por m² e em tempo até o trabalho: é aí que está o melhor equilíbrio entre pagar menos e perder menos tempo." : "Cadastre seus locais de trabalho para ver a fronteira preço × tempo de deslocamento."}>
        {frontier.length > 0 && <p className="mb-3 text-sm"><b>Fronteira preço × deslocamento:</b> {frontier.map((b) => b.area).join(", ")}.</p>}
        <RegionTable rows={g.bairros.slice(0, 20)} kind="bairro" mode={mode} hasCommute={g.hasWorkplaces} />
        <p className="mt-3 text-sm"><Link href={`/bairros?modo=${mode}`} className="font-medium text-primary hover:underline">Análise completa de todos os bairros (infraestrutura, transporte e risco) →</Link></p>
      </Step>

      <Step n={4} icon={Sparkles} title="Os imóveis que valem a visita" description={`Ordenados pela nota do Radar com os seus pesos. ${EVALUATION_NOTE}`}>
        <h3 className="mb-2 text-sm font-medium">Dentro dos seus limites{g.hasWorkplaces ? ` (até ${g.maxCommuteMin} min)` : ""}{buy && g.maxPriceCents != null ? ` e até ${brl(g.maxPriceCents)}` : ""}{!buy && g.rentBudgetCents != null ? ` e até ${brl(g.rentBudgetCents)}/mês` : ""}</h3>
        <PickList picks={g.fitPicks} mode={mode} empty="Nenhum imóvel avaliado cabe nos seus limites agora. Ajuste o perfil ou crie um alerta na busca para ser avisado." />
        <h3 className="mt-5 mb-2 text-sm font-medium">Melhores notas no geral</h3>
        <PickList picks={g.picks} mode={mode} empty="As notas aparecem depois da primeira coleta." />
        <p className="mt-3 text-sm"><Link href={`/?modo=${mode}&ordem=melhor_avaliacao${g.hasWorkplaces ? `&deslocamentoMax=${g.maxCommuteMin}` : ""}`} className="font-medium text-primary hover:underline">Ver todos na busca →</Link></p>
      </Step>

      <Step n={5} icon={Scale} title="Como fechar bem" description="Em cada imóvel, a seção Negociação e decisão traz o plano de proposta (abrir, meta, teto), se cabe no orçamento e a lista do que conferir antes de assinar.">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Compare 3 a 5 finalistas lado a lado em <Link href={`/comparar?modo=${mode}`} className="text-primary hover:underline">Comparar</Link>.</li>
          <li>Visite no seu horário de saída para o trabalho e, se puder, num dia de chuva.</li>
          <li>Proponha começando pelo valor de abertura e use a mediana dos parecidos como argumento.</li>
          <li>{buy ? "Antes do sinal, peça matrícula atualizada, certidões e simule em mais de um banco." : "Antes de assinar, confirme condomínio, IPTU e taxas por escrito e faça a vistoria com fotos."}</li>
          <li>Acompanhe o preço dos finalistas: o Radar avisa reduções e quando a meta for atingida.</li>
        </ol>
      </Step>
    </div>
  );
}
