"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, FlaskConical, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NeighborhoodStats } from "@/server/queries/neighborhoods";
import { cn } from "@/lib/utils";
import { columnsFor } from "./columns";
import { NeighborhoodCompare } from "./neighborhood-compare";

const MAX = 4;

/** Sortable neighbourhood table with search and a side-by-side comparison of up to 4 bairros. */
export function NeighborhoodExplorer({ rows, mode = "aluguel" }: { rows: NeighborhoodStats[]; mode?: "aluguel" | "compra" }) {
  const COLUMNS = useMemo(() => columnsFor(mode), [mode]);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "count", dir: -1 });
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key) ?? COLUMNS[0];
    const term = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return rows
      .filter((r) => !term || r.key.includes(term) || (r.regional ?? "").toLowerCase().includes(term))
      .sort((a, b) => {
        const x = col.value(a);
        const y = col.value(b);
        if (x == null) return 1;
        if (y == null) return -1;
        return (x - y) * sort.dir || a.name.localeCompare(b.name, "pt-BR");
      });
  }, [rows, sort, q, COLUMNS]);
  const toggle = (key: string) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : p.length >= MAX ? p : [...p, key]));
  const selected = picked.map((k) => rows.find((r) => r.key === k)).filter((r): r is NeighborhoodStats => Boolean(r));
  return (
    <div className="space-y-4">
      {selected.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Comparando {selected.length} bairro{selected.length > 1 ? "s" : ""}</h2>
            <Button variant="ghost" size="sm" onClick={() => setPicked([])}>Limpar</Button>
          </div>
          <NeighborhoodCompare rows={selected} onRemove={toggle} mode={mode} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar bairro ou regional" className="pl-8" aria-label="Filtrar bairros" />
        </div>
        <p className="text-xs text-muted-foreground">Marque até {MAX} bairros para comparar lado a lado. Use o cabeçalho para ordenar. O nome do bairro abre a busca com os melhores avaliados.</p>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-card shadow-[0_1px_0_var(--border)]">
            <tr>
              <th className="sticky left-0 z-30 bg-card p-2.5 text-left text-xs font-medium text-muted-foreground">Bairro</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="p-2.5 text-right text-xs font-medium whitespace-nowrap text-muted-foreground" title={c.help ?? c.label} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  <button type="button" className="inline-flex items-center gap-0.5 hover:text-foreground" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : c.better === "min" ? 1 : -1 }))}>
                    {c.short ?? c.label}
                    {sort.key === c.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const on = picked.includes(r.key);
              return (
                <tr key={r.key} className={cn("border-t hover:bg-muted/40", on && "bg-accent/50")}>
                  <th scope="row" className={cn("sticky left-0 z-10 bg-card p-2.5 text-left font-normal", on && "bg-accent")}>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" className="size-4 accent-primary" checked={on} disabled={!on && picked.length >= MAX} onChange={() => toggle(r.key)} aria-label={`Comparar ${r.name}`} />
                      <span className="min-w-0">
                        <Link href={`/?modo=${mode}&bairros=${encodeURIComponent(r.name)}&ordem=melhor_avaliacao`} className="font-medium hover:text-primary">{r.name}</Link>
                        <span className="block text-[11px] text-muted-foreground">
                          {r.regional ?? "Regional ?"}
                          {r.demoCount > 0 && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-demo" title={`${r.demoCount} de ${r.count} imóveis são de demonstração`}>
                              <FlaskConical className="size-3" />
                              {r.demoCount === r.count ? "demo" : `${r.demoCount} demo`}
                            </span>
                          )}
                        </span>
                      </span>
                    </label>
                  </th>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="p-2.5 text-right whitespace-nowrap tabular-nums">{c.show(r)}</td>
                  ))}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="p-8 text-center text-sm text-muted-foreground">
                  <X className="mx-auto mb-1 size-5" />Nenhum bairro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
