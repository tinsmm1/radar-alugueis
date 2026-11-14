"use client";
import Link from "next/link";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (n: number) => void }) {
  if (pages <= 1) return null;
  const go = (n: number) => {
    onPage(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const near = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return (
    <nav className="flex items-center justify-center gap-1 pt-2" aria-label="Páginas de resultados">
      <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Página anterior">
        <ChevronLeft />
      </Button>
      {near.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && n - near[i - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Button variant={n === page ? "default" : "ghost"} size="icon-sm" onClick={() => go(n)} aria-current={n === page ? "page" : undefined}>
            {n}
          </Button>
        </span>
      ))}
      <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Próxima página">
        <ChevronRight />
      </Button>
    </nav>
  );
}

export function EmptyResults({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <SearchX className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium">{filtered ? "Nenhum imóvel com esses filtros" : "Nada nesta página"}</p>
        <p className="mt-1 text-sm text-muted-foreground">Afrouxe algum critério, aumente o raio ou tire a área do mapa.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onClear}>
          Limpar filtros
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">Ver fontes</Link>
        </Button>
      </div>
    </div>
  );
}
