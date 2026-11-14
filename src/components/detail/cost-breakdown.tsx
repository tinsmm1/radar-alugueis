import { Info } from "lucide-react";
import { costPerM2, monthlyCost, type CostInput } from "@/domain/cost";
import { brl, brlCents } from "@/domain/money";
import { cn } from "@/lib/utils";

function Row({ label, cents, note, missing, strong }: { label: string; cents: number | null; note?: string; missing?: boolean; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-2", strong && "pt-3")}>
      <dt className={cn("text-sm", strong ? "font-semibold" : "text-muted-foreground")}>
        {label}
        {note && <span className="ml-1 text-xs text-muted-foreground">({note})</span>}
      </dt>
      <dd className={cn("shrink-0 text-right whitespace-nowrap tabular-nums", strong ? "text-xl font-semibold" : "text-sm", missing && "text-amber-700")}>{missing ? "Não informado" : brlCents(cents)}</dd>
    </div>
  );
}

/**
 * Rent, additional costs and the known monthly total, separated as the spec asks. Unknown
 * values are shown as "Não informado" and never summed as zero; the total is then partial.
 */
export function CostBreakdown({ input, areaM2, iptuRaw }: { input: CostInput; areaM2: number | null; iptuRaw: number | null }) {
  const c = monthlyCost(input);
  const perM2 = costPerM2(c.totalKnownCents, areaM2);
  const annual = input.iptuPeriod === "anual" || (iptuRaw != null && c.iptuMonthlyCents != null && c.iptuMonthlyCents !== iptuRaw);
  return (
    <div>
      <dl className="divide-y">
        <Row label="Aluguel" cents={c.rentCents} missing={c.rentCents == null} />
        <div className="py-1">
          <p className="pt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Custos adicionais</p>
          <Row label="Condomínio" cents={c.condoCents} missing={c.condoCents == null} note={c.condoCents === 0 ? "isento" : undefined} />
          <Row label="IPTU mensal equivalente" cents={c.iptuMonthlyCents} missing={c.iptuMonthlyCents == null} note={annual && iptuRaw != null ? `${brl(iptuRaw)}/ano ÷ 12` : undefined} />
          {c.otherFeesCents != null && <Row label="Outras taxas recorrentes" cents={c.otherFeesCents} />}
          <Row label="Subtotal adicional conhecido" cents={c.extrasCents} />
        </div>
        <Row label="Custo mensal total conhecido" cents={c.totalKnownCents} missing={c.totalKnownCents == null} strong />
      </dl>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Custo total por m²</span>
        <span className="font-medium tabular-nums">{perM2 == null ? "—" : `${brlCents(perM2)}/m²`}</span>
      </div>
      {c.status !== "completo" && (
        <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            <b>Custo parcial.</b> {c.missing.length ? `Não informado: ${c.missing.join(", ")}.` : ""} Valores ausentes não foram contados como zero; o custo real pode ser maior.
          </span>
        </p>
      )}
    </div>
  );
}
