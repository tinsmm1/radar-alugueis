"use client";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { ListChecks, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MapViewProps } from "./map-view";
import { Legend, LayerControl } from "./map-controls";
import type { OverlayKey } from "./overlays";

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

const STORE = "radar:camadas";
const DEFAULT: OverlayKey[] = [];
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cache: OverlayKey[] = DEFAULT;

/** Active overlays remembered per browser (a convenience only); the server always renders none. */
function snapshot(): OverlayKey[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORE);
  } catch {
    // storage blocked
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      const v = JSON.parse(raw ?? "null") as unknown;
      cache = Array.isArray(v) ? (v.filter((x) => typeof x === "string" && x !== "bairros") as OverlayKey[]) : DEFAULT;
    } catch {
      cache = DEFAULT;
    }
  }
  return cache;
}

function save(next: OverlayKey[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(next));
  } catch {
    // storage blocked: keep in memory for this page
    cacheRaw = JSON.stringify(next);
    cache = next;
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

type Props = Omit<MapViewProps, "overlays" | "onBbox" | "bboxActive"> & {
  bbox: string | undefined;
  onBbox: (bbox: string | undefined) => void;
  /** Shown over the map on phones (back to the list). */
  onShowList?: () => void;
  className?: string;
};

/** The search map with its controls: layers, legend, bairro selection and "search this area". */
export function SearchMap({ bbox, onBbox, onShowList, className, ...rest }: Props) {
  const overlays = useSyncExternalStore(subscribe, snapshot, () => DEFAULT);
  const [selectBairros, setSelectBairros] = useState(false);
  const [legend, setLegend] = useState(true);
  const [count, setCount] = useState<number | null>(null);

  const toggle = (k: OverlayKey) => save(overlays.includes(k) ? overlays.filter((x) => x !== k) : [...overlays, k]);
  const active = selectBairros ? [...overlays, "bairros" as const] : overlays;

  return (
    <div className={cn("relative size-full overflow-hidden bg-muted", className)}>
      <MapView {...rest} overlays={active} bboxActive={Boolean(bbox)} onBbox={(b) => onBbox(b ?? undefined)} onPoints={setCount} />
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start gap-2">
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <LayerControl active={active} onToggle={toggle} selectBairros={selectBairros} onSelectBairros={setSelectBairros} bboxActive={Boolean(bbox)} onBbox={(v) => onBbox(v ? "pending" : undefined)} />
          <Button size="sm" variant={bbox ? "default" : "outline"} className={cn("shadow-sm", !bbox && "bg-card")} onClick={() => onBbox(bbox ? undefined : "pending")} aria-pressed={Boolean(bbox)}>
            <MousePointerClick />
            {bbox ? "Buscando nesta área" : "Buscar nesta área"}
          </Button>
          {onShowList && (
            <Button size="sm" variant="outline" className="bg-card shadow-sm lg:hidden" onClick={onShowList}>
              <ListChecks />
              Lista
            </Button>
          )}
        </div>
        {count != null && <span className="pointer-events-auto ml-auto rounded-full border bg-card/95 px-2.5 py-1 text-xs shadow-sm">{count.toLocaleString("pt-BR")} no mapa</span>}
      </div>
      {selectBairros && <p className="pointer-events-none absolute top-14 left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground shadow">Clique nos bairros para incluir ou retirar do filtro</p>}
      <div className="absolute bottom-8 left-3 z-10">
        {legend ? (
          <div className="relative">
            <Legend active={active} />
            <button type="button" onClick={() => setLegend(false)} className="absolute top-1.5 right-2 text-[11px] text-muted-foreground hover:text-foreground">
              ocultar
            </button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="bg-card shadow-sm" onClick={() => setLegend(true)}>
            Legenda
          </Button>
        )}
      </div>
    </div>
  );
}
