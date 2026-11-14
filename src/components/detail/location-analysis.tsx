import { ExternalLink, Info, ShieldAlert } from "lucide-react";
import { CATEGORY_HELP, CATEGORY_LABEL } from "@/domain/layers";
import { meters } from "@/domain/money";
import { analysisItems, INDEX_DISCLAIMER, INDEX_LABEL, LEVEL_LABEL, NO_RECORD_NOTE, riskIndex, type AnalysisItem, type ItemLevel, type LocationFacts } from "@/domain/risk";
import { RISK_CLASS } from "@/components/property/badges";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const LEVEL_CLASS: Record<ItemLevel, string> = {
  alto: "bg-risk-high/12 text-risk-high ring-risk-high/25",
  atencao: "bg-risk-attention/14 text-[oklch(0.52_0.16_45)] ring-risk-attention/30",
  moderado: "bg-risk-moderate/15 text-[oklch(0.5_0.12_75)] ring-risk-moderate/30",
  baixo: "bg-risk-low/12 text-risk-low ring-risk-low/25",
  positivo: "bg-positive/12 text-positive ring-positive/25",
  neutro: "bg-muted text-muted-foreground ring-border",
  sem_dados: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

const GROUPS: Array<{ key: AnalysisItem["group"]; title: string }> = [
  { key: "ambiental", title: "Riscos ambientais" },
  { key: "urbano", title: "Entorno urbano" },
  { key: "servicos", title: "Serviços e transporte" },
];

const GAUGE: Record<string, string> = { baixo: "bg-risk-low", moderado: "bg-risk-moderate", atencao: "bg-risk-attention", alto: "bg-risk-high" };

function Item({ item }: { item: AnalysisItem }) {
  return (
    <li className="flex flex-col gap-1.5 py-3 sm:flex-row sm:gap-3">
      <span className={cn("mt-0.5 inline-flex h-6 w-fit shrink-0 items-center rounded-full px-2 text-[11px] font-medium ring-1 ring-inset", LEVEL_CLASS[item.level])}>{LEVEL_LABEL[item.level].replace(" segundo a base consultada", "")}</span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">
          {item.title}
          {item.distanceM != null && item.distanceM > 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {meters(item.distanceM)}</span>}
        </p>
        <p className="text-sm text-muted-foreground">{item.description}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help rounded bg-muted px-1.5 py-0.5 font-medium">{CATEGORY_LABEL[item.category]}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{CATEGORY_HELP[item.category]}</TooltipContent>
          </Tooltip>
          <span>Fonte: {item.source}</span>
          {item.sourceDate && <span>· {item.sourceDate}</span>}
          {item.sourceUrl && (
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
              base original <ExternalLink className="size-3" />
            </a>
          )}
        </p>
      </div>
    </li>
  );
}

/** "Análise da localização": risk index card + items grouped by theme, each with class, source, date and link. */
export function LocationAnalysis({ facts, analyzedAt }: { facts: LocationFacts | null; analyzedAt: Date | null }) {
  if (!facts) {
    return (
      <p className="flex gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        Este imóvel ainda não foi analisado: falta a localização ou a análise roda na próxima coleta. Sem análise não há como afirmar nada sobre riscos do local.
      </p>
    );
  }
  const idx = riskIndex(facts);
  const items = analysisItems(facts);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-xl border bg-gradient-to-br from-card to-accent/30 p-4 sm:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-4">
          <div className={cn("flex size-20 flex-col items-center justify-center rounded-2xl ring-1 ring-inset", RISK_CLASS[idx.level])}>
            <span className="text-2xl leading-none font-bold tabular-nums">{idx.score}</span>
            <span className="text-[10px] tracking-wide uppercase">de 100</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Índice de risco da localização</p>
            <p className="flex items-center gap-1.5 text-lg font-semibold">
              <ShieldAlert className="size-5" />
              {INDEX_LABEL[idx.level]}
            </p>
            <p className="text-xs text-muted-foreground">Confiança {idx.confidence === "normal" ? "normal" : "reduzida (local aproximado ou camada faltando)"}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className={cn("h-full rounded-full", GAUGE[idx.level])} style={{ width: `${Math.max(3, idx.score)}%` }} />
          </div>
          <p className="text-sm">{idx.reasons.length ? `Pesa no índice: ${idx.reasons.join("; ")}.` : "Nenhum fator de risco encontrado nas bases consultadas."}</p>
          <p className="text-xs text-muted-foreground">
            {INDEX_DISCLAIMER} {NO_RECORD_NOTE}
            {(facts.analyzedAt ?? analyzedAt) && ` Análise de ${new Date(facts.analyzedAt ?? analyzedAt!).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
            {facts.precision === "aproximada" && " · calculada sobre uma posição aproximada"}.
          </p>
        </div>
      </div>
      {GROUPS.map((g) => {
        const list = items.filter((i) => i.group === g.key);
        if (!list.length) return null;
        return (
          <section key={g.key}>
            <h3 className="text-sm font-semibold">{g.title}</h3>
            <ul className="divide-y">{list.map((i) => <Item key={i.key} item={i} />)}</ul>
          </section>
        );
      })}
    </div>
  );
}
