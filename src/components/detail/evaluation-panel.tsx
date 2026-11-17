import { CircleAlert, CircleCheck, Info, Mountain } from "lucide-react";
import { GRADE_CLASS } from "@/components/property/badges";
import { CONFIDENCE_LABEL, drivers, EVALUATION_NOTE, type Evaluation } from "@/domain/evaluation";
import { cn } from "@/lib/utils";

/** Critical evaluation of the offer: grade, score parts, strengths and points of attention. */
export function EvaluationPanel({ evaluation, mode }: { evaluation: Evaluation | null; mode: "aluguel" | "compra" }) {
  if (!evaluation) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        A avaliação deste imóvel {mode === "compra" ? "para compra" : "para aluguel"} é calculada a cada coleta, comparando-o com imóveis parecidos. Ela aparece aqui depois da próxima execução.
      </p>
    );
  }
  const e = evaluation;
  const d = drivers(e);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className={cn("flex size-16 shrink-0 items-center justify-center rounded-2xl text-3xl font-bold ring-1 ring-inset", GRADE_CLASS[e.grade])} aria-label={`Nota ${e.grade}`}>
          {e.grade}
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold">{e.label} <span className="text-sm font-normal text-muted-foreground">· {e.score}/100</span></p>
          <p className="text-xs text-muted-foreground">{CONFIDENCE_LABEL[e.confidence]}{e.confidence !== "alta" && ": faltam dados em parte dos critérios, que contam como neutros"}</p>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {e.parts.map((part) => (
          <li key={part.key} className="space-y-1">
            <div className="flex justify-between text-xs"><span>{part.label}</span><span className="tabular-nums text-muted-foreground">{part.points}/{part.max}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((part.points / part.max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {(d.up.length > 0 || d.down.length > 0) && (
        <p className="rounded-lg bg-muted/40 p-2.5 text-sm">
          <b>O que mais pesou:</b>{" "}
          {d.up.length > 0 && <span className="text-emerald-800">a favor, {d.up.map((p) => p.label.toLowerCase()).join(" e ")}</span>}
          {d.up.length > 0 && d.down.length > 0 && "; "}
          {d.down.length > 0 && <span className="text-amber-800">contra, {d.down.map((p) => p.label.toLowerCase()).join(" e ")}</span>}.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1.5 text-sm font-medium">Pontos fortes</h3>
          {e.pros.length ? (
            <ul className="space-y-1.5 text-sm">
              {e.pros.map((t) => <li key={t} className="flex gap-2"><CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />{t}</li>)}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nenhum destaque positivo identificado.</p>}
        </div>
        <div>
          <h3 className="mb-1.5 text-sm font-medium">Pontos de atenção</h3>
          {e.cons.length ? (
            <ul className="space-y-1.5 text-sm">
              {e.cons.map((t) => <li key={t} className="flex gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />{t}</li>)}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nenhum ponto de atenção nas bases consultadas.</p>}
        </div>
      </div>
      {e.riskNote && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="flex gap-2"><Mountain className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{e.riskNote}</p>
          <p className="mt-1 text-xs text-muted-foreground">Informativo: o risco geográfico (deslizamento, inundação, enxurrada) não entra na nota. Detalhes na análise da localização.</p>
        </div>
      )}
      <p className="flex gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" />{EVALUATION_NOTE}</p>
    </div>
  );
}
