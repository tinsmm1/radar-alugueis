"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { groupDigits, parseBrNumber } from "@/domain/money";

/** Collapsible filter group with a count of active criteria. */
export function Section({ title, icon, active = 0, defaultOpen = true, children }: { title: string; icon?: ReactNode; active?: number; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b last:border-b-0">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 py-3 text-left text-sm font-semibold">
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1">{title}</span>
        {active > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] leading-5 font-medium text-primary-foreground">{active}</span>}
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && <div className="space-y-4 pb-4">{children}</div>}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground/80">{label}</p>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Pressable chip (multi or single choice). */
export function Chip({ on, onClick, children, className, title }: { on: boolean; onClick: () => void; children: ReactNode; className?: string; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/80 hover:border-primary/40 hover:bg-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** One choice among options; clicking the active one clears it (undefined). */
export function ChoiceChips<T extends string | number>({ value, options, onChange }: { value: T | undefined; options: Array<[T, string]>; onChange: (v: T | undefined) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <Chip key={String(v)} on={value === v} onClick={() => onChange(value === v ? undefined : v)}>
          {label}
        </Chip>
      ))}
    </div>
  );
}

/** "2.500" → 2500; with a decimal step (e.g. a yield of "5,5"), keeps one decimal. */
function parseNum(raw: string, step?: number): number | undefined {
  const decimal = step != null && step < 1;
  const n = parseBrNumber(raw) ?? Number.NaN;
  if (raw.trim() === "" || !Number.isFinite(n) || n < 0) return undefined;
  return decimal ? Math.round(n * 10) / 10 : Math.round(n);
}

/**
 * Min–max pair committed on blur or Enter (not on every keystroke, so the URL and the search
 * do not change while typing). Inputs remount when the URL value changes.
 */
export function RangeInput({ min, max, onChange, prefix, suffix, step, idPrefix, single }: { min?: number; max?: number; onChange: (min?: number, max?: number) => void; prefix?: string; suffix?: string; step?: number; idPrefix: string; single?: "min" | "max" }) {
  const commit = (form: HTMLElement) => {
    const a = parseNum((form.querySelector(`#${idPrefix}-min`) as HTMLInputElement | null)?.value ?? "", step);
    const b = parseNum((form.querySelector(`#${idPrefix}-max`) as HTMLInputElement | null)?.value ?? "", step);
    if (a !== min || b !== max) onChange(a, b);
  };
  const props = (which: "min" | "max", value?: number) => ({
    id: `${idPrefix}-${which}`,
    defaultValue: value == null ? "" : groupDigits(String(value).replace(".", ",")),
    onInput: (e: React.FormEvent<HTMLInputElement>) => {
      e.currentTarget.value = groupDigits(e.currentTarget.value);
    },
    inputMode: (step != null && step < 1 ? "decimal" : "numeric") as "decimal" | "numeric",
    step,
    placeholder: which === "min" ? "Mín." : "Máx.",
    "aria-label": which === "min" ? "Mínimo" : "Máximo",
    className: cn("h-8 text-sm", prefix && "pl-8", suffix && "pr-9"),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => commit(e.currentTarget.parentElement!.parentElement!),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit(e.currentTarget.parentElement!.parentElement!);
      }
    },
  });
  const wrap = (child: ReactNode) => (
    <div className="relative min-w-0 flex-1">
      {prefix && <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
      {child}
      {suffix && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
  return (
    <div className="flex items-center gap-2">
      {single !== "max" && wrap(<Input key={`min-${min ?? ""}`} {...props("min", min)} />)}
      {!single && <span className="text-xs text-muted-foreground">a</span>}
      {single !== "min" && wrap(<Input key={`max-${max ?? ""}`} {...props("max", max)} />)}
    </div>
  );
}

export function SwitchRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <Label htmlFor={id} className="flex-col items-start gap-0.5 text-sm font-normal">
        {label}
        {hint && <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

const COUNTS: Array<[number, string]> = [[1, "1+"], [2, "2+"], [3, "3+"], [4, "4+"]];
export function MinCount({ value, onChange, zero }: { value?: number; onChange: (v?: number) => void; zero?: boolean }) {
  return <ChoiceChips value={value} options={zero ? [[0, "0+"], ...COUNTS] : COUNTS} onChange={onChange} />;
}
