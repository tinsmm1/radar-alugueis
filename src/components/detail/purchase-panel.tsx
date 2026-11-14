import { Info } from "lucide-react";
import { brl, pctBp } from "@/domain/money";

export type RentEstimate = { median: number; comparables: number; scope: "bairro" | "regional" | "regional_todos"; cents: number | null } | null;

const SCOPE: Record<NonNullable<RentEstimate>["scope"], string> = {
  bairro: "imóveis para alugar do mesmo bairro, tipo e faixa de quartos",
  regional: "imóveis para alugar da mesma regional, tipo e faixa de quartos",
  regional_todos: "todos os imóveis para alugar da regional (estimativa mais grosseira)",
};

/** Sidebar of the buy view: price, price per m², maintenance, estimated rent and gross yield. */
export function PurchasePanel({ priceCents, priceM2Cents, condoCents, iptuMonthlyCents, estRentCents, yieldBp, estimate }: {
  priceCents: number | null; priceM2Cents: number | null; condoCents: number | null; iptuMonthlyCents: number | null; estRentCents: number | null; yieldBp: number | null; estimate: RentEstimate;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Preço de venda</p>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{brl(priceCents)}</p>
        {priceM2Cents != null && <p className="text-sm text-muted-foreground">{brl(priceM2Cents)}/m²</p>}
      </div>
      <dl className="divide-y rounded-xl border text-sm">
        <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">Condomínio</dt><dd className="tabular-nums">{condoCents == null ? "Não informado" : `${brl(condoCents)}/mês`}</dd></div>
        <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">IPTU (mensal)</dt><dd className="tabular-nums">{iptuMonthlyCents == null ? "Não informado" : `${brl(iptuMonthlyCents)}/mês`}</dd></div>
        <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">Aluguel estimado</dt><dd className="tabular-nums">{estRentCents == null ? "Sem comparáveis" : `${brl(estRentCents)}/mês`}</dd></div>
        <div className="flex justify-between gap-3 px-3 py-2 font-medium"><dt>Rendimento bruto estimado</dt><dd className="tabular-nums text-primary">{yieldBp == null ? "—" : `${pctBp(yieldBp)} a.a.`}</dd></div>
      </dl>
      {estimate && (
        <p className="flex gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Aluguel estimado pela mediana de {brl(estimate.median)}/m² de {estimate.comparables} {SCOPE[estimate.scope]}. É uma referência de mercado, não uma avaliação.
        </p>
      )}
    </div>
  );
}
