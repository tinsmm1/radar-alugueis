import { ExternalLink } from "lucide-react";
import { ActionButton } from "@/components/admin/action-button";
import { LayerImport } from "@/components/admin/layer-import";
import { Empty, Pill, ScrollTable, Section, StatusPill } from "@/components/admin/ui";
import { CATEGORY_LABEL, type LayerCategory } from "@/domain/layers";
import { deleteLayer, refreshLayer } from "@/server/actions/admin";
import { formatDateTime, layersOverview } from "@/server/queries/admin";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Camadas" };
export const dynamic = "force-dynamic";

const BUILTIN = ["sgb_inundacao", "sgb_movimento_massa", "sgb_enxurrada", "sgb_risco_geologico", "regionais", "osm"];

export default async function LayersPage() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const rows = await layersOverview();
  const missing = BUILTIN.filter((k) => !rows.some((r) => r.key === k));
  return (
    <>
      <Section
        title="Camadas geográficas"
        description="Base da análise da localização. As camadas são atualizadas sozinhas pela coleta (SGB a cada 90 dias, OpenStreetMap a cada 30, regionais a cada 180). Atualizar aqui leva até 1 minuto e reanalisa os imóveis."
      >
        {rows.length === 0 ? (
          <Empty>Nenhuma camada carregada. A primeira coleta carrega todas.</Empty>
        ) : (
          <ScrollTable>
            <thead>
              <tr>
                <th>Camada</th>
                <th>Tipo</th>
                <th>Fonte</th>
                <th>Feições</th>
                <th>Situação</th>
                <th>Atualizada</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const imported = l.key.startsWith("importada:");
                return (
                  <tr key={l.key}>
                    <td>
                      <p className="font-medium">{l.title}</p>
                      {imported && <Pill tone="info" className="mt-1">Importada</Pill>}
                    </td>
                    <td className="text-xs">{CATEGORY_LABEL[l.category as LayerCategory] ?? l.category}</td>
                    <td className="max-w-[260px] text-xs">
                      {l.sourceUrl ? (
                        <a href={l.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-start gap-1 text-primary hover:underline">
                          {l.source}
                          <ExternalLink className="mt-0.5 size-3 shrink-0" />
                        </a>
                      ) : (
                        l.source
                      )}
                      {l.sourceDate && <p className="text-muted-foreground">{/^\d{4}/.test(l.sourceDate) ? `Dados de ${l.sourceDate}` : `Data: ${l.sourceDate}`}</p>}
                    </td>
                    <td>{l.featureCount.toLocaleString("pt-BR")}</td>
                    <td>
                      <StatusPill status={l.status} />
                      {l.error && <p className="mt-1 max-w-[220px] text-xs text-red-700">{l.error}</p>}
                    </td>
                    <td className="text-xs whitespace-nowrap">{formatDateTime(l.refreshedAt)}</td>
                    <td>
                      <div className="flex justify-end">
                        {imported ? (
                          <ActionButton action={deleteLayer.bind(null, l.key)} variant="destructive" confirm={`Remover a camada "${l.title}"? Os imóveis serão reanalisados sem ela.`} success="Camada removida.">
                            Remover
                          </ActionButton>
                        ) : BUILTIN.includes(l.key) ? (
                          <ActionButton action={refreshLayer.bind(null, l.key)} pendingLabel="Atualizando…" confirm={l.key === "osm" ? "Recarregar o OpenStreetMap apaga e recarrega a infraestrutura urbana (cerca de 1 minuto). Continuar?" : undefined}>
                            Atualizar
                          </ActionButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ScrollTable>
        )}
        {missing.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            Ainda não carregadas:
            {missing.map((k) => (
              <ActionButton key={k} action={refreshLayer.bind(null, k)} pendingLabel="Carregando…">
                Carregar {k}
              </ActionButton>
            ))}
          </div>
        )}
      </Section>
      <Section
        title="Importar camada oficial (PBH, Defesa Civil)"
        description={
          <>
            Os serviços geográficos da Prefeitura (BHMap) bloqueiam acesso automático de servidores. Baixe no seu navegador, no portal oficial de dados da PBH, a camada desejada (ex.: áreas de risco geológico da Urbel, manchas de inundação, pontos críticos de alagamento da Defesa Civil), exporte em <b>GeoJSON com coordenadas WGS84 (EPSG:4326)</b> e envie aqui.
          </>
        }
      >
        <LayerImport />
      </Section>
    </>
  );
}
