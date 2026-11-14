import Link from "next/link";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClearCompare, CompareSync } from "@/components/compare/compare-sync";
import { CompareTable } from "@/components/compare/compare-table";
import { compareItems, COMPARE_LIMIT } from "@/server/queries/compare";
import { requireAuth } from "@/auth/session";
import { currentMode } from "@/server/mode";

export const metadata = { title: "Comparar imóveis" };

export default async function ComparePage({ searchParams }: PageProps<"/comparar">) {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const sp = await searchParams;
  const raw = sp.ids;
  const mode = await currentMode(sp.modo);
  const urlIds = String(Array.isArray(raw) ? raw[0] : (raw ?? ""))
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, COMPARE_LIMIT);
  const items = await compareItems(urlIds);
  return (
    <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 lg:px-6">
      <CompareSync urlIds={urlIds} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comparar imóveis</h1>
          <p className="text-sm text-muted-foreground">Até {COMPARE_LIMIT} imóveis lado a lado. Em verde, o melhor valor de cada linha (quando há diferença).</p>
        </div>
        <ClearCompare />
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <Columns3 className="size-10 text-muted-foreground" />
          <h2 className="font-semibold">Nenhum imóvel no comparador</h2>
          <p className="max-w-md text-sm text-muted-foreground">Na busca ou na página de um imóvel, toque no botão de comparar para incluí-lo aqui.</p>
          <Button asChild>
            <Link href="/">Ir para a busca</Link>
          </Button>
        </div>
      ) : (
        <>
          <CompareTable items={items} mode={mode} />
          {items.length === 1 && <p className="text-sm text-muted-foreground">Adicione mais um imóvel para ver os destaques de cada linha.</p>}
          <p className="text-xs text-muted-foreground">Custos parciais não contam valores ausentes como zero. Riscos vêm da análise da localização de cada imóvel e não substituem avaliação técnica.</p>
        </>
      )}
    </div>
  );
}
