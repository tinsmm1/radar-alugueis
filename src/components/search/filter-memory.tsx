"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Not remembered: the hub mode (it picks the slot), the view, the page and the map area. */
const SKIP = new Set(["modo", "vista", "pagina", "bbox"]);
const key = (modo: string) => `radar_filtros_${modo}`;

function filterParams(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of params) if (!SKIP.has(k)) out.append(k, v);
  return out;
}

/**
 * Keeps the search filters across pages and visits (one set per mode). Coming back to the search
 * without filters in the URL restores the last ones; they only go away when every filter is
 * removed, as "Limpar tudo" does. Browser storage may be unavailable: then it simply does nothing.
 */
export function FilterMemory() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const first = useRef(true);

  useEffect(() => {
    const modo = params.get("modo") ?? "aluguel";
    const current = filterParams(new URLSearchParams(params.toString()));
    try {
      if (first.current) {
        first.current = false;
        const saved = localStorage.getItem(key(modo));
        if (!current.toString() && saved) {
          const next = new URLSearchParams(saved);
          for (const k of ["modo", "vista"]) {
            const v = params.get(k);
            if (v) next.set(k, v);
          }
          router.replace(`${pathname}?${next.toString()}`, { scroll: false });
          return;
        }
      }
      if (current.toString()) localStorage.setItem(key(modo), current.toString());
      else localStorage.removeItem(key(modo));
    } catch {
      // Storage blocked (private mode, policy): filters stay in the URL only.
    }
  }, [params, pathname, router]);

  return null;
}
