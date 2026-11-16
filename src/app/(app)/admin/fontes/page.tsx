import { ApifyFiltersForm } from "@/components/admin/apify-filters-form";
import { ApifyForm } from "@/components/admin/apify-form";
import { describeFilters } from "@/domain/collect-filters";
import { getCollectFilters } from "@/server/collect-filters";
import { FeedForm } from "@/components/admin/feed-form";
import { envState } from "@/lib/env";
import { PortalList, SourcesTable } from "@/components/admin/sources-table";
import { Section } from "@/components/admin/ui";
import { sourcesOverview } from "@/server/queries/admin";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Fontes" };
export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const [all, filters] = await Promise.all([sourcesOverview(), getCollectFilters()]);
  const collected = all.filter((s) => s.adapter !== "portal");
  const portals = all.filter((s) => s.adapter === "portal");
  return (
    <>
      <Section
        title="Fontes em uso"
        description="Cada fonte é coletada de forma independente: se uma falhar, as outras continuam. Uma falha gera notificação e fica registrada abaixo."
      >
        <SourcesTable rows={collected} />
      </Section>
      <Section
        title="Adicionar feed autorizado"
        description="Imobiliárias publicam seus anúncios em XML no padrão VRSync (o mesmo enviado ao ZAP e ao Viva Real). Com a autorização delas, o Radar lê esse feed duas vezes por dia."
      >
        <FeedForm />
      </Section>
      <Section
        title="Portais via Apify (coleta automática)"
        description="Robôs prontos do Apify leem ZAP, Viva Real, OLX, QuintoAndar, Imovelweb e outros. Crie as tarefas no Apify (uma de aluguel e outra de venda); o Radar inicia uma execução por dia de cada uma e calcula sozinho o limite de anúncios e de gasto para o crédito grátis de US$ 5 durar o mês todo."
      >
        <ApifyForm hasToken={envState("APIFY_TOKEN") === "valid"} />
      </Section>
      <Section
        title="Filtros da coleta automática"
        description="Padrão: o robô traz todos os apartamentos e casas de BH. Com filtros, ele busca só o que você escolher e o crédito rende mais. Valem para as tarefas de aluguel e de venda a partir da próxima execução."
      >
        <ApifyFiltersForm initial={filters} summary={describeFilters(filters)} />
      </Section>
      <Section
        title="Portais: integrações pendentes"
        description="Antes de qualquer coletor, cada portal foi avaliado (API, robots.txt, termos de uso e resposta a acesso automatizado). Nenhum oferece integração de leitura autorizada; por isso não são coletados."
      >
        <PortalList rows={portals} />
      </Section>
    </>
  );
}
