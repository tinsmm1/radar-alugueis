import { ExternalLink } from "lucide-react";
import { deleteFeed, setFeedStatus } from "@/server/actions/admin";
import { formatDateTime, formatDuration, type SourceView } from "@/server/queries/admin";
import { ActionButton } from "./action-button";
import { Pill, ScrollTable, StatusPill } from "./ui";

function portalLabel(s: SourceView) {
  const blocked = s.assessment?.verdict.toLowerCase().includes("bloqueado");
  return <Pill tone={blocked ? "error" : "muted"}>{blocked ? "Bloqueado pelos termos" : "Pendente"}</Pill>;
}

/** Collected sources (feeds, uploads, manual, demo) with their latest run counts. */
export function SourcesTable({ rows }: { rows: SourceView[] }) {
  return (
    <ScrollTable>
      <thead>
        <tr>
          <th>Fonte</th>
          <th>Situação</th>
          <th>Anúncios</th>
          <th>Última execução</th>
          <th>Lidos · novos · atualizados</th>
          <th>Preço · duplic. · ausentes</th>
          <th>Duração</th>
          <th className="text-right">Ações</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => {
          const r = s.latest;
          return (
            <tr key={s.id} className={s.consecutiveFailures ? "bg-red-50/50" : undefined}>
              <td>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.adapterLabel}</p>
                {s.isDemo && <Pill tone="demo" className="mt-1">Fictícia</Pill>}
                {s.url && s.adapter === "vrsync" && <p className="max-w-[260px] truncate text-xs text-muted-foreground" title={s.url}>{s.url}</p>}
                {s.authorization && <p className="max-w-[260px] text-xs text-muted-foreground">Autorização: {s.authorization}</p>}
              </td>
              <td>
                <StatusPill status={s.status} />
                {s.consecutiveFailures > 0 && <p className="mt-1 text-xs text-red-700">{s.consecutiveFailures} falha(s) seguidas</p>}
                {s.lastError && <p className="mt-1 max-w-[240px] text-xs text-red-700">{s.lastError}</p>}
              </td>
              <td className="whitespace-nowrap">
                {s.listings}
                <span className="text-xs text-muted-foreground"> ({s.active} ativos)</span>
              </td>
              <td className="whitespace-nowrap text-xs">
                {formatDateTime(s.lastRunAt)}
                <p className="text-muted-foreground">último OK: {formatDateTime(s.lastOkAt)}</p>
                {r && <StatusPill status={r.status} />}
              </td>
              <td className="whitespace-nowrap">{r ? `${r.fetched} · ${r.created} · ${r.updated}` : "—"}</td>
              <td className="whitespace-nowrap">{r ? `${r.priceChanges} · ${r.duplicates} · ${r.missing}` : "—"}</td>
              <td className="whitespace-nowrap">{formatDuration(r?.durationMs)}</td>
              <td>
                {s.adapter === "vrsync" ? (
                  <div className="flex justify-end gap-1.5">
                    {s.status === "pausada" ? (
                      <ActionButton action={setFeedStatus.bind(null, s.id, "ativa")} success="Fonte reativada.">Reativar</ActionButton>
                    ) : (
                      <ActionButton action={setFeedStatus.bind(null, s.id, "pausada")} success="Fonte pausada.">Pausar</ActionButton>
                    )}
                    <ActionButton action={deleteFeed.bind(null, s.id)} variant="destructive" confirm={`Remover a fonte "${s.name}" e os anúncios dela? Favoritos são mantidos.`} success="Fonte removida.">
                      Remover
                    </ActionButton>
                  </div>
                ) : (
                  <p className="text-right text-xs text-muted-foreground">—</p>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </ScrollTable>
  );
}

/** Portals: integration pending, with the documented assessment. */
export function PortalList({ rows }: { rows: SourceView[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((s) => {
        const a = s.assessment;
        return (
          <li key={s.id}>
            <details className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 marker:hidden">
                <span className="font-medium">{s.name}</span>
                {portalLabel(s)}
                <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Ver avaliação</span>
              </summary>
              {a ? (
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[140px_1fr]">
                  <dt className="text-muted-foreground">API oficial</dt>
                  <dd>{a.api}</dd>
                  <dt className="text-muted-foreground">robots.txt</dt>
                  <dd>{a.robots}</dd>
                  <dt className="text-muted-foreground">Termos de uso</dt>
                  <dd>{a.terms}</dd>
                  <dt className="text-muted-foreground">Acesso automatizado</dt>
                  <dd>{a.access}</dd>
                  <dt className="text-muted-foreground">Conclusão</dt>
                  <dd className="font-medium">{a.verdict}</dd>
                  <dt className="text-muted-foreground">Caminho</dt>
                  <dd>{a.path}</dd>
                  <dt className="text-muted-foreground">Verificado em</dt>
                  <dd>
                    {new Date(`${a.checkedAt}T12:00:00Z`).toLocaleDateString("pt-BR")} ·{" "}
                    <a href={a.site} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                      {a.site.replace(/^https:\/\//, "")}
                      <ExternalLink className="size-3" />
                    </a>
                  </dd>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Sem avaliação registrada.</p>
              )}
            </details>
          </li>
        );
      })}
    </ul>
  );
}
