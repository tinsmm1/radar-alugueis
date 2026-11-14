"use client";
import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EMPTY_FILTER, filterFromParams, filterToParams, type Filter } from "@/domain/filters";

export type View = "dividido" | "lista" | "mapa";
export const VIEWS: View[] = ["dividido", "lista", "mapa"];

/** Params that are not part of the filter but live in the same URL. */
const EXTRA = ["vista"] as const;

/**
 * The URL is the single source of truth for the search: filter, view and page. Updates replace
 * the URL without scrolling; any filter change goes back to page 1.
 */
export function useFilterNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const filter = useMemo(() => filterFromParams(params), [params]);
  const view: View = VIEWS.includes(params.get("vista") as View) ? (params.get("vista") as View) : "dividido";
  const page = Math.max(1, Number(params.get("pagina")) || 1);

  const go = useCallback(
    (next: Filter, extra: Record<string, string | null> = {}) => {
      const p = filterToParams(next);
      for (const k of EXTRA) {
        const v = k in extra ? extra[k] : params.get(k);
        if (v) p.set(k, v);
      }
      if (extra.pagina) p.set("pagina", extra.pagina);
      const qs = p.toString();
      start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  return {
    filter,
    view,
    page,
    pending,
    update: (patch: Partial<Filter>) => go({ ...filter, ...patch }),
    clear: () => go({ ...EMPTY_FILTER, ordem: filter.ordem }),
    setView: (v: View) => go(filter, { vista: v === "dividido" ? null : v, pagina: page > 1 ? String(page) : null }),
    setPage: (n: number) => go(filter, { pagina: n > 1 ? String(n) : null }),
    /** Toggles a value inside a list field (bairros, regionais, tipos...). */
    toggle: <K extends "bairros" | "regionais" | "tipos" | "caracteristicas" | "fontes">(key: K, value: Filter[K][number]) => {
      const list = filter[key] as string[];
      const next = list.includes(value as string) ? list.filter((x) => x !== value) : [...list, value as string];
      go({ ...filter, [key]: next } as Filter);
    },
  };
}

/** Filter params for the map points endpoint (the visible area is not part of it). */
export function mapQuery(filter: Filter): string {
  return filterToParams({ ...filter, bbox: undefined }).toString();
}
