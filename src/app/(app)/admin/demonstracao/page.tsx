import { FlaskConical } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { Pill, Section } from "@/components/admin/ui";
import { loadDemo, removeDemoData } from "@/server/actions/admin";
import { overview } from "@/server/queries/admin";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Demonstração" };
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const o = await overview();
  const loaded = o.counts.demo > 0;
  return (
    <Section
      title="Dados de demonstração"
      description="Servem apenas para conhecer a interface enquanto nenhuma fonte autorizada está conectada."
      actions={loaded ? <Pill tone="demo"><FlaskConical className="size-3" />{o.counts.demo} anúncios fictícios carregados</Pill> : <Pill>Não carregados</Pill>}
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-demo/30 bg-demo/8 p-4">
          <p className="font-medium">O que são</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Anúncios <b>fictícios</b>: preços e características inventados, sem link para anúncio real e com “[DEMONSTRAÇÃO]” no título.</li>
            <li>As posições são centros reais de bairros (OpenStreetMap) com pequeno deslocamento; a análise da localização usa as camadas reais.</li>
            <li>Duas fontes fictícias e três momentos ao longo de 10 dias mostram deduplicação, histórico de preço, reduções e anúncios que somem.</li>
            <li>São comparados só entre si: nunca entram nas médias de bairros ou oportunidades dos anúncios reais, e não geram notificações.</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton action={loadDemo} variant="default" pendingLabel="Carregando…" success="Dados de demonstração carregados." confirm={loaded ? "Recarregar a demonstração atualiza os anúncios fictícios existentes. Continuar?" : undefined}>
            {loaded ? "Recarregar demonstração" : "Carregar demonstração"}
          </ActionButton>
          {loaded && (
            <ActionButton action={removeDemoData} variant="destructive" pendingLabel="Removendo…" success="Dados de demonstração removidos." confirm="Remover todos os anúncios fictícios de demonstração? Dados reais não são afetados.">
              Remover demonstração
            </ActionButton>
          )}
        </div>
        <p className="text-xs text-muted-foreground">A demonstração precisa da camada do OpenStreetMap (bairros) carregada em Camadas.</p>
      </div>
    </Section>
  );
}
