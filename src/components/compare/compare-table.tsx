import Link from "next/link";
import { Trophy } from "lucide-react";
import { DemoBadge, GradeBadge, RiskBadge } from "@/components/property/badges";
import { Photo } from "@/components/property/card";
import { FEATURE_LABEL, TYPE_LABEL, type Feature, type PropertyType } from "@/domain/listing";
import { brl, m2, meters, pctBp } from "@/domain/money";
import type { CompareItem } from "@/server/queries/compare";
import { cn } from "@/lib/utils";
import { RemoveFromCompare } from "./compare-sync";

type Row = {
  label: string;
  value: (i: CompareItem) => number | null;
  show: (i: CompareItem) => React.ReactNode;
  /** Shown only in rent (rent) or buy (buy) mode; neither = both. */
  rent?: boolean;
  buy?: boolean;
  /** Which end is better; omitted rows get no highlight. */
  best?: "min" | "max";
};

const LEVEL = ["Fora", "Baixa", "Média", "Alta"];
const susc = (v: number | null) => (v == null ? "Sem análise" : LEVEL[v] ?? "—");

const ALL_ROWS: Row[] = [
  { label: "Avaliação do Radar (aluguel)", rent: true, value: (i) => i.rentEvalScore, show: (i) => (i.rentEvalScore == null ? (i.forRent ? "Na próxima coleta" : "Não está para alugar") : <GradeBadge score={i.rentEvalScore} long />), best: "max" },
  { label: "Avaliação do Radar (compra)", buy: true, value: (i) => i.saleEvalScore, show: (i) => (i.saleEvalScore == null ? (i.forSale ? "Na próxima coleta" : "Não está à venda") : <GradeBadge score={i.saleEvalScore} long />), best: "max" },
  { label: "Custo mensal total", rent: true, value: (i) => i.totalCents, show: (i) => <span className="font-semibold">{brl(i.totalCents)}{i.costStatus === "parcial" && <span className="ml-1 text-[11px] font-normal text-amber-700">parcial</span>}</span>, best: "min" },
  { label: "Aluguel", rent: true, value: (i) => i.rentCents, show: (i) => brl(i.rentCents), best: "min" },
  { label: "Preço de venda", buy: true, value: (i) => i.salePriceCents, show: (i) => <span className="font-semibold">{brl(i.salePriceCents)}</span>, best: "min" },
  { label: "Preço por m²", buy: true, value: (i) => i.salePriceM2Cents, show: (i) => (i.salePriceM2Cents == null ? "—" : `${brl(i.salePriceM2Cents)}/m²`), best: "min" },
  { label: "Aluguel estimado", buy: true, value: (i) => i.estRentCents, show: (i) => (i.estRentCents == null ? "Sem comparáveis" : `${brl(i.estRentCents)}/mês`), best: "max" },
  { label: "Rendimento bruto estimado", buy: true, value: (i) => i.grossYieldBp, show: (i) => (i.grossYieldBp == null ? "—" : `${pctBp(i.grossYieldBp)} a.a.`), best: "max" },
  { label: "Condomínio", value: (i) => i.condoCents, show: (i) => (i.condoCents == null ? "Não informado" : brl(i.condoCents)), best: "min" },
  { label: "IPTU (mensal)", value: (i) => i.iptuMonthlyCents, show: (i) => (i.iptuMonthlyCents == null ? "Não informado" : brl(i.iptuMonthlyCents)), best: "min" },
  { label: "Área privativa", value: (i) => i.areaM2, show: (i) => m2(i.areaM2), best: "max" },
  { label: "Custo total por m²", rent: true, value: (i) => i.costPerM2Cents, show: (i) => (i.costPerM2Cents == null ? "—" : `${brl(i.costPerM2Cents)}/m²`), best: "min" },
  { label: "Quartos", value: (i) => i.bedrooms, show: (i) => i.bedrooms ?? "—", best: "max" },
  { label: "Suítes", value: (i) => i.suites, show: (i) => i.suites ?? "—", best: "max" },
  { label: "Vagas", value: (i) => i.parking, show: (i) => i.parking ?? "—", best: "max" },
  { label: "Características", value: (i) => i.features.length, show: (i) => <span className="text-xs leading-relaxed">{i.features.length ? i.features.map((f) => FEATURE_LABEL[f as Feature] ?? f).join(", ") : "Nenhuma informada"}</span>, best: "max" },
  { label: "Localização", value: () => null, show: (i) => <span className="text-xs">{[i.street, i.neighborhood, i.regional && `Regional ${i.regional}`].filter(Boolean).join(" · ") || "—"}{i.geoPrecision !== "exata" && <span className="block text-muted-foreground">posição aproximada</span>}</span> },
  { label: "Índice de risco", value: (i) => i.riskScore, show: (i) => <RiskBadge level={i.riskLevel} score={i.riskScore} />, best: "min" },
  { label: "Inundação (suscetibilidade)", value: (i) => i.floodLevel, show: (i) => susc(i.floodLevel), best: "min" },
  { label: "Deslizamento (suscetibilidade)", value: (i) => i.landslideLevel, show: (i) => susc(i.landslideLevel), best: "min" },
  { label: "Transporte público mais próximo", value: (i) => i.transitM, show: (i) => (i.transitM == null ? "Sem dado" : <span className="text-xs">{meters(i.transitM)}<span className="block text-muted-foreground">{i.transitName}</span></span>), best: "min" },
];

function bestOf(row: Row, items: CompareItem[]): number | null {
  if (!row.best) return null;
  const vals = items.map(row.value).filter((v): v is number => v != null);
  if (vals.length < 2 || new Set(vals).size < 2) return null;
  return row.best === "min" ? Math.min(...vals) : Math.max(...vals);
}

/** Side-by-side table; the best value of each row is highlighted (only when values differ). */
export function CompareTable({ items, mode = "aluguel" }: { items: CompareItem[]; mode?: "aluguel" | "compra" }) {
  const ROWS = ALL_ROWS.filter((r) => (mode === "compra" ? !r.rent : !r.buy));
  const wins = new Map<number, number>(items.map((i) => [i.id, 0]));
  const bests = ROWS.map((r) => bestOf(r, items));
  ROWS.forEach((r, k) => items.forEach((i) => bests[k] != null && r.value(i) === bests[k] && wins.set(i.id, (wins.get(i.id) ?? 0) + 1)));
  const top = Math.max(...wins.values());
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full border-collapse text-sm" style={{ minWidth: 180 + items.length * 190 }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-44 bg-card p-3 text-left align-bottom text-xs font-medium text-muted-foreground">{items.length} imóve{items.length > 1 ? "is" : "l"}</th>
            {items.map((i) => (
              <th key={i.id} className="w-[190px] p-3 text-left align-top font-normal">
                <div className="relative overflow-hidden rounded-xl border">
                  <Photo src={i.photo} alt="" className="h-28 w-full" />
                  <div className="absolute top-1.5 right-1.5"><RemoveFromCompare id={i.id} /></div>
                  {i.isDemo && <DemoBadge className="absolute top-1.5 left-1.5 bg-white/95" />}
                </div>
                <Link href={`/imovel/${i.id}?modo=${mode}`} className="mt-2 line-clamp-2 block font-medium hover:text-primary">
                  {i.title?.replace(/^\[DEMONSTRAÇÃO\]\s*/, "") || (i.type ? TYPE_LABEL[i.type as PropertyType] : "Imóvel")}
                </Link>
                {(mode === "compra" ? !i.forSale : !i.forRent) && <span className="mt-1 block text-[11px] text-amber-700">{mode === "compra" ? "Só para alugar" : "Só à venda"}: troque o modo para ver os valores</span>}
                {wins.get(i.id) === top && top > 0 && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-positive/12 px-2 py-0.5 text-[11px] font-medium text-positive"><Trophy className="size-3" /> Mais vantagens ({top})</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r, k) => (
            <tr key={r.label} className="border-t">
              <th scope="row" className="sticky left-0 z-10 bg-card p-3 text-left text-xs font-medium text-muted-foreground">{r.label}</th>
              {items.map((i) => {
                const win = bests[k] != null && r.value(i) === bests[k];
                return (
                  <td key={i.id} className={cn("p-3 align-top tabular-nums", win && "bg-positive/8")}>
                    <span className="inline-flex flex-wrap items-center gap-1">
                      {r.show(i)}
                      {win && <span className="rounded-full bg-positive px-1.5 text-[10px] leading-4 font-semibold text-white">melhor</span>}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
