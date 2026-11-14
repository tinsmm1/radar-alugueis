import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Card section with title, optional description and actions. */
export function Section({ title, description, actions, children, className }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-xs", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

const TONES = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  error: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-accent text-accent-foreground ring-primary/20",
  muted: "bg-muted text-muted-foreground ring-border",
  demo: "bg-demo/12 text-demo ring-demo/30",
} as const;
export type Tone = keyof typeof TONES;

export function Pill({ tone = "muted", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset", TONES[tone], className)}>{children}</span>;
}

/** Status of runs, sources and layers → tone + label. */
export function statusTone(status: string | null | undefined): { tone: Tone; label: string } {
  switch (status) {
    case "ok":
      return { tone: "ok", label: "OK" };
    case "ativa":
      return { tone: "ok", label: "Ativa" };
    case "partial":
      return { tone: "warn", label: "Parcial" };
    case "running":
      return { tone: "info", label: "Em andamento" };
    case "carregando":
      return { tone: "info", label: "Carregando" };
    case "failed":
    case "erro":
      return { tone: "error", label: "Falhou" };
    case "skipped":
      return { tone: "muted", label: "Pulada" };
    case "pausada":
      return { tone: "warn", label: "Pausada" };
    case "pendente":
      return { tone: "muted", label: "Pendente" };
    case "bloqueada":
      return { tone: "error", label: "Bloqueada" };
    default:
      return { tone: "muted", label: status ?? "—" };
  }
}

export function StatusPill({ status }: { status: string | null | undefined }) {
  const s = statusTone(status);
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-background/60 px-3.5 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Table that scrolls inside its own box on narrow screens. */
export function ScrollTable({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[640px] border-collapse text-sm [&_td]:border-t [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-muted-foreground">
        {children}
      </table>
    </div>
  );
}
