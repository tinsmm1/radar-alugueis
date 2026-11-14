import { Empty, Pill, Section, StatusPill } from "@/components/admin/ui";
import { formatDateTime, formatDuration, runsHistory, uploadHistory } from "@/server/queries/admin";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Execuções" };
export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<string, string> = {
  fontes: "Fontes", camadas: "Camadas", geocodificar: "Geocodificação", analisar: "Análise", oportunidades: "Oportunidades", notificar: "Notificações", retencao: "Retenção", concluido: "Concluída",
};
const TRIGGER_LABEL: Record<string, string> = { github: "GitHub Actions", vercel: "Vercel Cron", manual: "Manual" };

function statsLine(stats: unknown): string {
  const s = (stats ?? {}) as Record<string, unknown>;
  const parts = [
    s.geocodificados != null && `${s.geocodificados} localizados`,
    s.analisados != null && `${s.analisados} analisados`,
    s.oportunidades != null && `${s.oportunidades} oportunidades`,
    s.emails ? `${s.emails} e-mails` : null,
    s.telegram ? `${s.telegram} Telegram` : null,
    ...Object.entries(s)
      .filter(([k]) => k.startsWith("camada:"))
      .map(([k, v]) => `${k.slice(7)}: ${String(v)}`),
  ].filter(Boolean);
  return parts.join(" · ");
}

export default async function RunsPage() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const [runs, uploads] = await Promise.all([runsHistory(30), uploadHistory(15)]);
  return (
    <>
      <Section title="Execuções da coleta" description="Últimas 30 rodadas. Cada rodada passa por fontes, camadas, geocodificação, análise, oportunidades, notificações e retenção. Falhas de uma fonte não interrompem as demais.">
        {runs.length === 0 ? (
          <Empty>Nenhuma execução ainda. Use “Executar coleta agora” na visão geral.</Empty>
        ) : (
          <ol className="space-y-3">
            {runs.map((r) => {
              const failed = r.sources.filter((s) => s.status === "failed");
              return (
                <li key={r.id} className={`rounded-lg border p-3.5 ${r.status === "failed" ? "border-red-200 bg-red-50/40" : r.status === "partial" ? "border-amber-200 bg-amber-50/30" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">#{r.id}</span>
                    <StatusPill status={r.status} />
                    <span className="text-muted-foreground">{TRIGGER_LABEL[r.trigger] ?? r.trigger}</span>
                    <span className="text-muted-foreground">· {formatDateTime(r.startedAt)}</span>
                    <span className="text-muted-foreground">· {formatDuration(r.durationMs)}</span>
                    {r.status === "running" && <Pill tone="info">Etapa: {STAGE_LABEL[r.stage ?? ""] ?? r.stage}</Pill>}
                  </div>
                  {r.error && <p className="mt-1.5 text-sm text-red-700">{r.error}</p>}
                  {statsLine(r.stats) && <p className="mt-1.5 text-xs text-muted-foreground">{statsLine(r.stats)}</p>}
                  {r.sources.length > 0 && (
                    <details className="mt-2" open={failed.length > 0}>
                      <summary className="cursor-pointer text-xs font-medium text-primary">{r.sources.length} fonte(s){failed.length ? `, ${failed.length} com falha` : ""}</summary>
                      <ul className="mt-2 space-y-1.5 text-xs">
                        {r.sources.map((s) => (
                          <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <StatusPill status={s.status} />
                            <span className="font-medium">{s.sourceName}</span>
                            {s.status !== "skipped" && (
                              <span className="text-muted-foreground">
                                {s.fetched} lidos · {s.created} novos · {s.updated} atualizados · {s.priceChanges} mudanças de preço · {s.duplicates} em duplicidade · {s.missing} ausentes · {formatDuration(s.durationMs)}
                                {s.attempt > 1 ? ` · ${s.attempt} tentativas` : ""}
                              </span>
                            )}
                            {s.error && <span className={s.status === "failed" ? "w-full text-red-700" : "w-full text-muted-foreground"}>{s.error}</span>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Section>
      <Section title="Importações e cadastros manuais" description="Planilhas e anúncios cadastrados à mão entram fora das rodadas agendadas.">
        {uploads.length === 0 ? (
          <Empty>Nenhuma importação ainda.</Empty>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {uploads.map((u) => (
              <li key={u.id} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{u.sourceName}</span>
                <span className="text-muted-foreground">
                  {formatDateTime(u.startedAt)} · {u.fetched} lidos · {u.created} novos · {u.updated} atualizados{u.skipped ? ` · ${u.skipped} linhas rejeitadas` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
