import Link from "next/link";
import { Heart, Target, TrendingDown } from "lucide-react";
import { brl, pctBp } from "@/domain/money";
import { allWatches } from "@/server/queries/watches";
import { PropertyCardView } from "@/components/property/card";
import { ListManager } from "@/components/personal/list-manager";
import { NoteEditor } from "@/components/personal/note-editor";
import { cn } from "@/lib/utils";
import { lists } from "@/server/favorites";
import { favoriteChanges, favoriteItems, recentDrop } from "@/server/queries/personal";
import { requireAuth } from "@/auth/session";
import { currentMode } from "@/server/mode";

export const metadata = { title: "Favoritos" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage({ searchParams }: PageProps<"/favoritos">) {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const sp = await searchParams;
  const mode = await currentMode(sp.modo);
  const all = await lists();
  const wanted = Number(sp.lista);
  const current = all.find((l) => l.id === wanted) ?? all[0] ?? null;
  const [items, changes, watches] = await Promise.all([current ? favoriteItems(current.id) : [], favoriteChanges(), allWatches()]);
  const recent = recentDrop;
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Favoritos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize imóveis em listas, anote impressões e acompanhe preço e disponibilidade. Quedas de preço dos favoritos viram notificações; para um preço-alvo, use <b>Acompanhar preço</b> na página do imóvel.
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
            <Link href="/buscas" className="font-medium text-primary hover:underline">Buscas salvas e alertas</Link>
            <Link href="/notificacoes" className="font-medium text-primary hover:underline">Notificações</Link>
          </p>
        </div>
        <ListManager current={current} permanent={current?.id === all[0]?.id} />
      </div>

      {changes.length > 0 && (
        <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><TrendingDown className="size-4 text-emerald-700" />Mudanças nos seus favoritos</h2>
          <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
            {changes.map((c) => (
              <li key={c.id}>
                <Link href={`/imovel/${c.id}?modo=${recent(c.saleDropBp, c.saleDroppedAt) && !recent(c.dropBp, c.droppedAt) ? "compra" : mode}`} className="hover:underline">
                  <b>{c.title?.replace(/^\[DEMONSTRAÇÃO\]\s*/, "") ?? "Imóvel"}</b>
                  <span className="text-muted-foreground">
                    {" "}
                    · {c.status !== "ativo"
                      ? c.status === "indisponivel" ? "indisponível" : "possivelmente indisponível"
                      : [recent(c.dropBp, c.droppedAt) && `aluguel −${pctBp(c.dropBp)}`, recent(c.saleDropBp, c.saleDroppedAt) && `venda −${pctBp(c.saleDropBp)}`].filter(Boolean).join(" · ")}
                    {c.isDemo ? " (demonstração)" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {watches.length > 0 && (
        <section className="mb-6 rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Target className="size-4 text-primary" />Preços que você acompanha ({watches.length})</h2>
          <ul className="mt-2 divide-y text-sm">
            {watches.map((w) => {
              const change = w.startPriceCents && w.currentCents != null ? Math.round(((w.currentCents - w.startPriceCents) / w.startPriceCents) * 10_000) : null;
              const reached = w.targetCents != null && w.currentCents != null && w.currentCents <= w.targetCents;
              const unit = w.mode === "compra" ? "" : "/mês";
              return (
                <li key={`${w.card.id}-${w.mode}`}>
                  <Link href={`/imovel/${w.card.id}?modo=${w.mode}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2 hover:text-primary">
                    <span className="rounded bg-muted px-1.5 text-[11px] font-medium">{w.mode === "compra" ? "Comprar" : "Alugar"}</span>
                    <b className="min-w-0 flex-1 truncate">{w.card.title?.replace(/^\[DEMONSTRAÇÃO\]\s*/, "") ?? "Imóvel"}{w.card.isDemo ? " (demonstração)" : ""}</b>
                    <span className="text-muted-foreground">{brl(w.startPriceCents)} → <b className="text-foreground">{brl(w.currentCents)}{unit}</b>{change ? <span className={change < 0 ? "text-emerald-700" : ""}> ({change < 0 ? "−" : "+"}{pctBp(Math.abs(change))})</span> : null}</span>
                    {w.targetCents != null && <span className={reached ? "font-medium text-emerald-700" : "text-muted-foreground"}>alvo {brl(w.targetCents)}{reached ? " · atingido" : ""}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <nav aria-label="Listas" className="-mx-4 mb-5 overflow-x-auto px-4">
        <ul className="flex w-max gap-1.5">
          {all.map((l) => (
            <li key={l.id}>
              <Link
                href={`/favoritos?lista=${l.id}&modo=${mode}`}
                aria-current={l.id === current?.id ? "page" : undefined}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium text-muted-foreground hover:bg-accent", l.id === current?.id && "border-primary bg-accent text-accent-foreground")}
              >
                {l.name}
                <span className="rounded-full bg-background px-1.5 text-xs">{l.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <Heart className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum imóvel nesta lista</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Toque no coração de um imóvel na busca ou na página dele para salvá-lo aqui.</p>
          <Link href="/" className="mt-4 text-sm font-medium text-primary hover:underline">Ir para a busca</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((it) => (
            <li key={it.card.id} className="space-y-2">
              <PropertyCardView p={it.card} favorite mode={mode} />
              <NoteEditor propertyId={it.card.id} listId={current!.id} initial={it.note} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
