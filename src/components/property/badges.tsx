import { Award, CircleAlert, FlaskConical, MapPin, Sparkles, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { COST_STATUS_LABEL, type CostStatus } from "@/domain/cost";
import { pctBp } from "@/domain/money";
import { SIGNAL_LABEL, type OpportunitySignal } from "@/domain/opportunity";
import { INDEX_LABEL, type RiskIndex } from "@/domain/risk";
import { GRADE_LABEL, gradeOf, type Grade } from "@/domain/evaluation";
import { cn } from "@/lib/utils";

export const RISK_CLASS: Record<RiskIndex["level"], string> = {
  baixo: "bg-risk-low/12 text-risk-low ring-risk-low/25",
  moderado: "bg-risk-moderate/15 text-[oklch(0.5_0.12_75)] ring-risk-moderate/30",
  atencao: "bg-risk-attention/14 text-[oklch(0.52_0.16_45)] ring-risk-attention/30",
  alto: "bg-risk-high/12 text-risk-high ring-risk-high/25",
};

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap";

/** Location risk index pill ("Risco: Atenção · 42"); "Sem análise" when not computed yet. */
export function RiskBadge({ level, score, className }: { level: string | null; score?: number | null; className?: string }) {
  if (!level) return <span className={cn(pill, "bg-muted text-muted-foreground ring-border", className)}>Risco: sem análise</span>;
  const l = level as RiskIndex["level"];
  return (
    <span className={cn(pill, RISK_CLASS[l], className)} title="Índice de risco da localização (resumo das bases consultadas; não substitui avaliação técnica)">
      <CircleAlert className="size-3" aria-hidden />
      Risco: {INDEX_LABEL[l]}
      {score != null && <span className="opacity-70">· {score}</span>}
    </span>
  );
}

/** Mandatory on every demo listing: these are not real offers. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span className={cn(pill, "bg-demo/12 text-demo ring-demo/30", className)} title="Dado de demonstração fictício: não é um anúncio real">
      <FlaskConical className="size-3" aria-hidden />
      Demonstração
    </span>
  );
}

export function CostStatusBadge({ status, missing }: { status: string | null; missing?: string[] }) {
  if (!status || status === "completo") return null;
  const label = COST_STATUS_LABEL[status as CostStatus];
  const badge = <span className={cn(pill, "bg-amber-50 text-amber-700 ring-amber-200")}>{label}</span>;
  if (!missing?.length) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>Não informado: {missing.join(", ")}. Valores ausentes não são contados como zero.</TooltipContent>
    </Tooltip>
  );
}

export function DropBadge({ dropBp, className }: { dropBp: number | null; className?: string }) {
  if (!dropBp || dropBp <= 0) return null;
  return (
    <span className={cn(pill, "bg-positive/12 text-positive ring-positive/25", className)}>
      <TrendingDown className="size-3" aria-hidden />−{pctBp(dropBp)}
    </span>
  );
}

export function OpportunityBadges({ data, max = 2 }: { data: unknown; max?: number }) {
  const signals = ((data as { signals?: OpportunitySignal[] } | null)?.signals ?? []).slice(0, max);
  return (
    <>
      {signals.map((s) => (
        <span key={s.kind} className={cn(pill, "bg-opportunity/10 text-opportunity ring-opportunity/25")}>
          <Sparkles className="size-3" aria-hidden />
          {s.kind === "abaixo_mercado" ? `${s.pctBelow.toLocaleString("pt-BR")}% abaixo` : s.kind === "alto_rendimento" ? `Rende ${pctBp(s.yieldBp)} a.a.` : SIGNAL_LABEL[s.kind]}
        </span>
      ))}
    </>
  );
}

export function PrecisionBadge({ precision }: { precision: string | null }) {
  if (precision === "exata") return null;
  return (
    <span className={cn(pill, "bg-muted text-muted-foreground ring-border")} title="A posição no mapa é aproximada (centro do bairro ou endereço oculto pela fonte)">
      <MapPin className="size-3" aria-hidden />
      {precision ? "Local aproximado" : "Sem localização"}
    </span>
  );
}

export const SOURCE_LABEL: Record<string, string> = { demo: "Demonstração A", "demo-b": "Demonstração B", planilha: "Planilha", manual: "Manual" };

export function SourceBadges({ keys }: { keys: string[] }) {
  return (
    <>
      {keys.map((k) => (
        <Badge key={k} variant="secondary" className="h-5 rounded-md px-1.5 text-[11px] font-normal">
          {SOURCE_LABEL[k] ?? k.replace(/^feed-/, "").replace(/-/g, " ")}
        </Badge>
      ))}
    </>
  );
}

export const GRADE_CLASS: Record<Grade, string> = {
  A: "bg-emerald-600 text-white ring-emerald-700/30",
  B: "bg-teal-500 text-white ring-teal-600/30",
  C: "bg-slate-200 text-slate-800 ring-slate-300",
  D: "bg-amber-100 text-amber-900 ring-amber-300",
  E: "bg-rose-100 text-rose-900 ring-rose-300",
};

/** Critical evaluation grade of the offer in the current mode ("A · 86"); nothing before the first evaluation. */
export function GradeBadge({ score, className, long }: { score: number | null | undefined; className?: string; long?: boolean }) {
  if (score == null) return null;
  const g = gradeOf(score);
  return (
    <span className={cn(pill, "font-semibold", GRADE_CLASS[g], className)} title={`Avaliação do Radar: ${GRADE_LABEL[g]} (${score}/100). Compara preço, custos ou rendimento, risco, serviços e dados com imóveis parecidos.`}>
      <Award className="size-3" aria-hidden />
      {long ? `Avaliação ${g} · ${GRADE_LABEL[g]}` : g}
      <span className="font-normal opacity-80">· {score}</span>
    </span>
  );
}
