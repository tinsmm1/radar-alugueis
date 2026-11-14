import { FlaskConical, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NeighborhoodExplorer } from "@/components/neighborhoods/neighborhood-explorer";
import { BestNeighborhoods } from "@/components/neighborhoods/best-neighborhoods";
import { brl, m2, pctBp } from "@/domain/money";
import { neighborhoodStats, regionalStats } from "@/server/queries/neighborhoods";
import { requireAuth } from "@/auth/session";
import { currentMode } from "@/server/mode";

export const metadata = { title: "Comparar bairros" };

export default async function NeighborhoodsPage({ searchParams }: PageProps<"/bairros">) {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const mode = await currentMode((await searchParams).modo);
  const buy = mode === "compra";
  const [rows, regionais] = await Promise.all([neighborhoodStats(mode), regionalStats(mode)]);
  const demo = rows.reduce((a, r) => a + r.demoCount, 0);
  const total = rows.reduce((a, r) => a + r.count, 0);
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Análise comparativa de bairros</h1>
        <p className="text-sm text-muted-foreground">
          {buy ? "Preço, preço por m², rendimento estimado, oferta, infraestrutura, transporte e risco de cada bairro com imóveis à venda no radar." : "Custo, oferta de imóveis para alugar, infraestrutura, transporte e risco de cada bairro de BH com imóveis no radar."}
        </p>
      </div>
      {demo > 0 && (
        <p className="flex gap-2 rounded-xl border border-demo/30 bg-demo/8 p-3.5 text-sm">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-demo" />
          <span>
            <b className="text-demo">{demo === total ? "Todos os" : `${demo} de ${total}`} imóveis usados aqui são dados de demonstração.</b> {buy ? "Os valores de mercado (preço, preço por m², rendimento, área) desses bairros são fictícios;" : "Os valores de mercado (aluguel, custo, área) desses bairros são fictícios;"} a infraestrutura e os riscos vêm de bases reais.
          </span>
        </p>
      )}
      <BestNeighborhoods rows={rows} mode={mode} />
      <Tabs defaultValue="bairros">
        <TabsList>
          <TabsTrigger value="bairros">Bairros ({rows.length})</TabsTrigger>
          <TabsTrigger value="regionais">Regionais ({regionais.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="bairros" className="mt-4">
          {rows.length ? <NeighborhoodExplorer rows={rows} mode={mode} /> : <p className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Ainda não há imóveis ativos com bairro informado.</p>}
        </TabsContent>
        <TabsContent value="regionais" className="mt-4">
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  {["Regional", "Bairros", "Imóveis", ...(buy ? ["Preço mediano", "R$/m² (mediana)", "Rendimento (mediana)"] : ["Aluguel mediano", "Total mediano", "R$/m² (mediana)"]), "Área média", buy ? "Sem cond./IPTU" : "Custo parcial", "Em suscet. a inundação", "Risco médio"].map((h) => (
                    <th key={h} className="p-2.5 text-right font-medium first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {regionais.map((r) => (
                  <tr key={r.name} className="hover:bg-muted/40">
                    <th scope="row" className="p-2.5 text-left font-medium">
                      {r.name}
                      {r.demoCount > 0 && <span className="ml-1.5 text-[11px] font-normal text-demo">{r.demoCount === r.count ? "demo" : `${r.demoCount} demo`}</span>}
                    </th>
                    <td className="p-2.5 text-right whitespace-nowrap tabular-nums">{r.neighborhoods}</td>
                    <td className="p-2.5 text-right whitespace-nowrap tabular-nums">{r.count}</td>
                    <td className="p-2.5 text-right whitespace-nowrap tabular-nums">{brl(buy ? r.medianPriceCents : r.medianRentCents)}</td>
                    <td className="p-2.5 text-right whitespace-nowrap tabular-nums">{buy ? brl(r.medianPriceM2Cents) : brl(r.medianTotalCents)}</td>
                    <td className="p-2.5 text-right whitespace-nowrap tabular-nums">{buy ? (r.medianYieldBp == null ? "—" : `${pctBp(r.medianYieldBp)} a.a.`) : brl(r.medianCostM2Cents)}</td>
                    <td className="p-2.5 text-right whitespace-nowrap tabular-nums">{m2(r.avgAreaM2)}</td>
                    <td className="p-2.5 text-right whitespace-nowrap tabular-nums">{r.partialPct}%</td>
                    <td className="p-2.5 text-right whitespace-nowrap tabular-nums">{r.floodPct == null ? "—" : `${r.floodPct}%`}</td>
                    <td className="p-2.5 text-right whitespace-nowrap tabular-nums">{r.avgRisk ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
      <p className="flex gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Medianas dos imóveis ativos. Infraestrutura contada num raio de 1 km do centro do bairro (ponto do OpenStreetMap ou, sem ele, o centro dos imóveis), com dados do OpenStreetMap. Inundação: parcela dos imóveis analisados dentro das cartas de suscetibilidade do SGB/IPT. Estatísticas de segurança pública por bairro não estão disponíveis em dados oficiais abertos e por isso não aparecem.
      </p>
    </div>
  );
}
