import type { Mode } from "@/domain/listing";

/** Cookie that remembers the hub mode between pages (a convenience; the URL `modo` wins). */
export const MODE_COOKIE = "radar_modo";

export function parseMode(value: unknown): Mode | null {
  return value === "compra" || value === "aluguel" ? value : null;
}

/** Same path and query with another mode (other query params kept, page reset). */
export function withMode(pathAndQuery: string, mode: Mode): string {
  const url = new URL(pathAndQuery, "http://radar.local");
  url.searchParams.delete("pagina");
  // Financial criteria and sorts belong to one mode only.
  for (const k of ["aluguelMin", "aluguelMax", "totalMin", "totalMax", "m2Max", "precoMin", "precoMax", "precoM2Max", "rendimentoMin", "ordem"]) url.searchParams.delete(k);
  if (mode === "aluguel") url.searchParams.delete("modo");
  else url.searchParams.set("modo", mode);
  const q = url.searchParams.toString();
  return url.pathname + (q ? `?${q}` : "");
}
