import Link from "next/link";
import { ArrowRight, Building2, MapPinned, Scale, Search } from "lucide-react";
import { SaveSearchDialog } from "@/components/search/save-search-dialog";
import { EMPTY_FILTER, searchHref, type Filter } from "@/domain/filters";
import type { PropertyType } from "@/domain/listing";

type P = { id: number; neighborhood: string | null; regional: string | null; type: string | null; bedrooms: number | null; totalCents: number | null; salePriceCents: number | null };

/** "Properties like this one" as a filter: same bairro, type, bedrooms ±1 and up to 10% above this price. */
export function similarFilter(p: P, mode: "aluguel" | "compra"): Filter {
  const price = mode === "compra" ? p.salePriceCents : p.totalCents;
  const cap = price != null ? Math.ceil((price * 1.1) / 100) : undefined;
  return {
    ...EMPTY_FILTER,
    modo: mode,
    bairros: p.neighborhood ? [p.neighborhood] : [],
    regionais: !p.neighborhood && p.regional ? [p.regional] : [],
    tipos: p.type ? [p.type as PropertyType] : [],
    quartosMin: p.bedrooms != null ? Math.max(0, p.bedrooms - 1) : undefined,
    quartosMax: p.bedrooms != null ? p.bedrooms + 1 : undefined,
    ...(mode === "compra" ? { precoMax: cap } : { totalMax: cap }),
    ordem: "melhor_avaliacao",
  };
}

/** Links from a property to the other tools, keeping the mode. */
export function RelatedLinks({ p, mode }: { p: P; mode: "aluguel" | "compra" }) {
  const qs = searchHref;
  const similar = similarFilter(p, mode);
  const inBairro: Filter = { ...EMPTY_FILTER, modo: mode, bairros: p.neighborhood ? [p.neighborhood] : [], ordem: "melhor_avaliacao" };
  const m = mode === "compra" ? "?modo=compra" : "?modo=aluguel";
  const item = "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent";
  return (
    <div className="space-y-2 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold">Continuar a análise</h2>
      <nav className="-mx-2 flex flex-col">
        <Link href={qs(similar)} className={item}><Search className="size-4 text-primary" /><span className="flex-1">Imóveis parecidos até 10% mais caros</span><ArrowRight className="size-3.5 text-muted-foreground" /></Link>
        {p.neighborhood && <Link href={qs(inBairro)} className={item}><MapPinned className="size-4 text-primary" /><span className="flex-1">Melhores ofertas em {p.neighborhood}</span><ArrowRight className="size-3.5 text-muted-foreground" /></Link>}
        <Link href={`/bairros${m}`} className={item}><Building2 className="size-4 text-primary" /><span className="flex-1">Comparar {p.neighborhood ?? "o bairro"} com outros bairros</span><ArrowRight className="size-3.5 text-muted-foreground" /></Link>
        <Link href={`/comparar${m}`} className={item}><Scale className="size-4 text-primary" /><span className="flex-1">Ver o comparador (inclua este imóvel no botão acima)</span><ArrowRight className="size-3.5 text-muted-foreground" /></Link>
      </nav>
      <SaveSearchDialog preset={similar} label="Criar alerta de imóveis parecidos" variant="outline" />
    </div>
  );
}
