import Link from "next/link";
import { Bookmark, Search } from "lucide-react";
import { DeleteSearch, NotifyToggle, SearchTitle } from "@/components/personal/search-controls";
import { Button } from "@/components/ui/button";
import { savedSearchViews } from "@/server/queries/personal";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Buscas salvas" };
export const dynamic = "force-dynamic";

export default async function SavedSearchesPage() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const searches = await savedSearchViews();
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6 lg:py-8">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Buscas salvas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A cada coleta, o Radar confere suas buscas e avisa sobre imóveis novos e reduções de preço. Para criar uma, ajuste os filtros na busca e toque em “Salvar busca”.
        </p>
      </div>
      {searches.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <Bookmark className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhuma busca salva</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Combine bairros, preço, quartos, características e risco, e salve para ser avisado.</p>
          <Button asChild className="mt-4">
            <Link href="/"><Search />Começar uma busca</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {searches.map((s) => (
            <li key={s.id} className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <SearchTitle id={s.id} name={s.name} />
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                  <p className="mt-2 text-sm">
                    <b>{s.matches.toLocaleString("pt-BR")}</b> imóveis hoje
                    {s.new24h > 0 && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">{s.new24h} novos em 24 h</span>}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/?${s.query}${/(^|&)modo=/.test(s.query) ? "" : `${s.query ? "&" : ""}modo=aluguel`}`}>Abrir busca</Link>
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-3">
                <NotifyToggle id={s.id} field="notifyNew" initial={s.notifyNew} label="Avisar imóveis novos" />
                <NotifyToggle id={s.id} field="notifyDrop" initial={s.notifyDrop} label="Avisar reduções de preço" />
                <span className="text-xs text-muted-foreground">Criada em {s.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                <div className="ml-auto">
                  <DeleteSearch id={s.id} name={s.name} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
