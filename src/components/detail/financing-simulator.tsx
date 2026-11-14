"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { brl } from "@/domain/money";
import { acquisition, ASSUMPTION_NOTE, buyVsRent, DEFAULT_ASSUMPTIONS, finance, ownershipMonthly, type Assumptions } from "@/domain/purchase";
import { cn } from "@/lib/utils";

const FIELDS: Array<{ key: keyof Assumptions; label: string; suffix: string; step: number; max: number }> = [
  { key: "downPct", label: "Entrada", suffix: "%", step: 1, max: 100 },
  { key: "annualRatePct", label: "Juros do financiamento", suffix: "% a.a.", step: 0.1, max: 30 },
  { key: "years", label: "Prazo", suffix: "anos", step: 1, max: 35 },
  { key: "itbiPct", label: "ITBI", suffix: "%", step: 0.1, max: 10 },
  { key: "registryPct", label: "Escritura e registro", suffix: "%", step: 0.1, max: 10 },
  { key: "investReturnPct", label: "Rendimento da entrada se investida", suffix: "% a.a.", step: 0.1, max: 30 },
  { key: "upkeepPct", label: "Manutenção", suffix: "% a.a.", step: 0.1, max: 5 },
];

function Row({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5 text-sm", strong && "font-semibold")}>
      <span className={strong ? "" : "text-muted-foreground"}>
        {label}
        {hint && <span className="block text-[11px] font-normal text-muted-foreground">{hint}</span>}
      </span>
      <span className="shrink-0 whitespace-nowrap tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Buy simulation with editable assumptions: cash needed, loan (SAC or Price), monthly cost of
 * owning, and buying vs renting an equivalent home (rent from comparables).
 */
export function FinancingSimulator({ priceCents, condoCents, iptuMonthlyCents, estRentCents }: { priceCents: number; condoCents: number | null; iptuMonthlyCents: number | null; estRentCents: number | null }) {
  const [a, setA] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [system, setSystem] = useState<"sac" | "price">("sac");
  const acq = acquisition(priceCents, a);
  const loan = finance(priceCents - acq.downCents, a.annualRatePct, a.years, system);
  const own = ownershipMonthly(priceCents, condoCents, iptuMonthlyCents, a);
  const vs = buyVsRent(priceCents, condoCents, iptuMonthlyCents, estRentCents, a, system);
  const set = (key: keyof Assumptions, raw: string) => {
    const n = Number(raw.replace(",", "."));
    if (Number.isFinite(n) && n >= 0) setA((x) => ({ ...x, [key]: n }));
  };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`sim-${f.key}`} className="text-xs text-muted-foreground">{f.label}</Label>
            <div className="relative">
              <Input id={`sim-${f.key}`} inputMode="decimal" defaultValue={String(a[f.key]).replace(".", ",")} onChange={(e) => set(f.key, e.target.value)} className="h-8 pr-14 text-sm" />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">{f.suffix}</span>
            </div>
          </div>
        ))}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Sistema</span>
          <ToggleGroup type="single" variant="outline" size="sm" value={system} onValueChange={(v) => v && setSystem(v as "sac" | "price")} className="w-full">
            <ToggleGroupItem value="sac" className="flex-1">SAC</ToggleGroupItem>
            <ToggleGroupItem value="price" className="flex-1">Price</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border p-4">
          <h3 className="mb-1 text-sm font-semibold">Dinheiro na compra</h3>
          <Row label={`Entrada (${a.downPct}%)`} value={brl(acq.downCents)} />
          <Row label={`ITBI (${a.itbiPct}%)`} value={brl(acq.itbiCents)} />
          <Row label="Escritura e registro" value={brl(acq.registryCents)} />
          <div className="mt-1 border-t pt-1"><Row label="Total à vista" value={brl(acq.upfrontCents)} strong /></div>
        </section>
        <section className="rounded-xl border p-4">
          <h3 className="mb-1 text-sm font-semibold">Financiamento ({system === "sac" ? "SAC" : "Price"})</h3>
          <Row label="Valor financiado" value={brl(loan.financedCents)} />
          <Row label="Primeira parcela" value={brl(loan.firstPaymentCents)} />
          <Row label="Última parcela" value={brl(loan.lastPaymentCents)} hint={system === "sac" ? "SAC: parcelas caem com o tempo" : "Price: parcelas iguais"} />
          <Row label="Juros no prazo todo" value={brl(loan.totalInterestCents)} />
          <div className="mt-1 border-t pt-1"><Row label="Total pago ao banco" value={brl(loan.totalPaidCents)} strong /></div>
        </section>
        <section className="rounded-xl border bg-accent/30 p-4 sm:col-span-2">
          <h3 className="mb-1 text-sm font-semibold">Comprar ou alugar? (1º mês)</h3>
          <Row label="Parcela + condomínio + IPTU + manutenção" value={brl(vs.buyMonthlyCents)} hint={own.partial ? "Condomínio ou IPTU não informado: custo parcial" : undefined} />
          <Row label="Alugar um equivalente (aluguel + condomínio + IPTU)" value={vs.rentMonthlyCents == null ? "Sem comparáveis" : brl(vs.rentMonthlyCents)} />
          <Row label="Rendimento perdido do dinheiro à vista" value={`${brl(vs.opportunityCostCents)}/mês`} />
          {vs.differenceCents != null && (
            <div className="mt-1 border-t pt-1">
              <Row label={vs.differenceCents > 0 ? "Comprar custa a mais por mês" : "Comprar custa a menos por mês"} value={brl(Math.abs(vs.differenceCents))} strong />
            </div>
          )}
          {vs.priceToRentYears != null && <p className="mt-2 text-xs text-muted-foreground">O preço equivale a {vs.priceToRentYears.toLocaleString("pt-BR")} anos de aluguel estimado.</p>}
        </section>
      </div>
      <p className="text-xs text-muted-foreground">{ASSUMPTION_NOTE} No primeiro mês a parcela inclui mais juros; no SAC ela diminui ao longo do prazo, e o imóvel pode valorizar ou desvalorizar.</p>
    </div>
  );
}
