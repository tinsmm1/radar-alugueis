"use client";
import { Columns2, List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { activeCount, SORT_LABEL, SORTS_BY_MODE, type Sort } from "@/domain/filters";
import { cn } from "@/lib/utils";
import { FilterPanel, type Facets } from "./filter-panel";
import { SaveSearchDialog } from "./save-search-dialog";
import { useFilterNav, type View } from "./use-filter-nav";

const VIEW_OPTIONS: Array<[View, string, typeof List]> = [["lista", "Lista", List], ["dividido", "Dividido", Columns2], ["mapa", "Mapa", MapIcon]];

export function ViewToggle({ className }: { className?: string }) {
  const { view, setView } = useFilterNav();
  return (
    <div role="radiogroup" aria-label="Visualização" className={cn("inline-flex rounded-lg border bg-card p-0.5", className)}>
      {VIEW_OPTIONS.map(([v, label, Icon]) => (
        <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors", view === v ? "bg-primary text-primary-foreground shadow-xs" : "hover:text-foreground", v === "dividido" && "hidden lg:inline-flex")}>
          <Icon className="size-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Results bar: count, mobile filters (sheet), sort, view and "save search". */
export function Toolbar({ total, facets }: { total: number; facets: Facets }) {
  const { filter, update, pending } = useFilterNav();
  const n = activeCount(filter) + (filter.bbox ? 1 : 0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="mr-auto w-full text-sm text-muted-foreground sm:w-auto" aria-live="polite">
        <span className="font-semibold text-foreground tabular-nums">{total.toLocaleString("pt-BR")}</span> {total === 1 ? "imóvel encontrado" : "imóveis encontrados"}
        {pending && <span className="ml-2 inline-block size-2 animate-pulse rounded-full bg-primary align-middle" aria-label="Atualizando" />}
      </p>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="xl:hidden">
            <SlidersHorizontal />
            Filtros
            {n > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] leading-5 text-primary-foreground">{n}</span>}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[92vw] max-w-sm gap-0 overflow-y-auto p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Os resultados atualizam a cada alteração.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pt-2 pb-8">
            <FilterPanel facets={facets} inSheet />
          </div>
        </SheetContent>
      </Sheet>
      <Select value={filter.ordem} onValueChange={(v) => update({ ordem: v as Sort })}>
        <SelectTrigger size="sm" className="w-[150px] bg-card sm:w-[190px]" aria-label="Ordenar por">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {SORTS_BY_MODE[filter.modo].map((s) => (
            <SelectItem key={s} value={s}>
              {SORT_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ViewToggle />
      <SaveSearchDialog />
    </div>
  );
}
