"use client";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchMap } from "@/components/map/search-map";
import type { MiniCard } from "@/components/map/popup";
import { PropertyCardView } from "@/components/property/card";
import type { PropertyCard } from "@/server/search";
import { cn } from "@/lib/utils";
import { EmptyResults, Pagination } from "./pagination";
import { mapQuery, useFilterNav } from "./use-filter-nav";

type Props = { items: PropertyCard[]; favorites: number[]; total: number; pages: number };

/**
 * List and map, synchronized: hovering a card highlights its pin, "ver no mapa" flies there,
 * clicking a pin opens its popup and scrolls the list to the card when it is on this page.
 */
export function Workspace({ items, favorites, total, pages }: Props) {
  const nav = useFilterNav();
  const { filter, view, page } = nav;
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [focused, setFocused] = useState<number | null>(null);
  // "Locate" toggles: first click flies to the property, second click returns to the previous view.
  const locate = (id: number) => {
    if (focused === id) {
      setFocused(null);
      setSelected(null);
      return;
    }
    setFocused(id);
    setSelected(id);
    setFocusKey((k) => k + 1);
  };
  const fav = useMemo(() => new Set(favorites), [favorites]);
  const cards = useMemo<Record<number, MiniCard>>(
    () => Object.fromEntries(items.map((p) => [p.id, { title: p.title?.replace(/^\[DEMONSTRAÇÃO\]\s*/, "") ?? "Imóvel", neighborhood: p.neighborhood, photo: p.photo }])),
    [items],
  );
  const perto = useMemo(() => {
    if (!filter.perto) return null;
    const [lat, lng] = filter.perto.split(",").map(Number);
    return { lat, lng, km: filter.raioKm ?? 2 };
  }, [filter.perto, filter.raioKm]);

  useEffect(() => {
    if (selected == null) return;
    document.getElementById(`card-${selected}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  const showMap = view !== "lista";
  const map = (
    <SearchMap
      query={mapQuery(filter)}
      selectedId={selected}
      hoveredId={hovered}
      focusKey={focusKey}
      focusId={focused}
      onSelect={setSelected}
      cards={cards}
      bbox={filter.bbox}
      onBbox={(b) => b !== filter.bbox && nav.update({ bbox: b })}
      bairros={filter.bairros}
      regionais={filter.regionais}
      onToggleBairro={(b) => nav.toggle("bairros", b)}
      onToggleRegional={(r) => nav.toggle("regionais", r)}
      perto={perto}
      onShowList={view === "mapa" ? () => nav.setView("lista") : undefined}
    />
  );

  const list = (
    <div className="space-y-4">
      {items.length === 0 ? (
        <EmptyResults filtered={total === 0} onClear={nav.clear} />
      ) : (
        <div className={cn("grid gap-3", view === "lista" ? "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : "sm:grid-cols-2")}>
          {items.map((p) => (
            <div
              key={p.id}
              id={`card-${p.id}`}
              className="relative scroll-mt-20"
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered((h) => (h === p.id ? null : h))}
              onFocus={() => setHovered(p.id)}
            >
              <PropertyCardView p={p} favorite={fav.has(p.id)} selected={selected === p.id} mode={filter.modo} />
              {showMap && p.lat != null && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  className={cn("absolute top-11 right-2 z-20 hidden rounded-full bg-white/95 shadow-sm lg:inline-flex", focused === p.id && "border-primary bg-primary text-primary-foreground hover:bg-primary/90")}
                  aria-label={focused === p.id ? "Voltar ao mapa anterior" : "Ver no mapa"}
                  aria-pressed={focused === p.id}
                  title={focused === p.id ? "Voltar ao mapa como estava" : "Ver no mapa"}
                  onClick={() => locate(p.id)}
                >
                  <Crosshair />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} onPage={nav.setPage} />
    </div>
  );

  if (view === "mapa") {
    return <div className="h-[calc(100dvh-3.5rem-4rem)] md:h-[calc(100dvh-3.5rem)]">{map}</div>;
  }
  return (
    <div className={cn("flex items-start", view === "dividido" && "lg:gap-0")}>
      <div className={cn("min-w-0 flex-1 px-4 pt-3 pb-8 lg:px-6", view === "dividido" && "lg:w-[min(46%,620px)] lg:flex-none lg:pr-4")}>
        {list}
        {view === "dividido" && (
          <Button onClick={() => nav.setView("mapa")} className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full shadow-lg lg:hidden" aria-label="Ver mapa">
            <MapIcon />
            Mapa
          </Button>
        )}
      </div>
      {view === "dividido" && <div className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] min-w-0 flex-1 border-l lg:block">{map}</div>}
    </div>
  );
}
