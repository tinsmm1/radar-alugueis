import { FeedForm } from "@/components/admin/feed-form";
import { PortalList, SourcesTable } from "@/components/admin/sources-table";
import { Section } from "@/components/admin/ui";
import { sourcesOverview } from "@/server/queries/admin";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Fontes" };
export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const all = await sourcesOverview();
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
        title="Portais: integrações pendentes"
        description="Antes de qualquer coletor, cada portal foi avaliado (API, robots.txt, termos de uso e resposta a acesso automatizado). Nenhum oferece integração de leitura autorizada; por isso não são coletados."
      >
        <PortalList rows={portals} />
      </Section>
    </>
  );
}
