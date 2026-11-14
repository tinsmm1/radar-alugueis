"use client";
import Link from "next/link";
import { FlaskConical, X } from "lucide-react";
import type { NeighborhoodStats } from "@/server/queries/neighborhoods";
import { cn } from "@/lib/utils";
import { columnsFor } from "./columns";

/** Up to 4 neighbourhoods side by side; the best value of each metric is highlighted. */
export function NeighborhoodCompare({ rows, onRemove, mode = "aluguel" }: { rows: NeighborhoodStats[]; onRemove: (key: string) => void; mode?: "aluguel" | "compra" }) {
  const COLUMNS = columnsFor(mode);
  const best = new Map<string, number>();
  for (const c of COLUMNS) {
    const vals = rows.map(c.value).filter((v): v is number => v != null);
    if (c.better && vals.length >= 2 && new Set(vals).size > 1) best.set(c.key, c.better === "min" ? Math.min(...vals) : Math.max(...vals));
  }
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full border-collapse text-sm" style={{ minWidth: 200 + rows.length * 160 }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-52 bg-card p-3" />
            {rows.map((r) => (
              <th key={r.key} className="p-3 text-left align-top">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/?modo=${mode}&bairros=${encodeURIComponent(r.name)}&ordem=melhor_avaliacao`} className="font-semibold hover:text-primary">{r.name}</Link>
                    <p className="text-xs font-normal text-muted-foreground">Regional {r.regional ?? "?"}</p>
                    {r.demoCount > 0 && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-normal text-demo">
                        <FlaskConical className="size-3" />
                        {r.demoCount === r.count ? "Só dados de demonstração" : `${r.demoCount} de ${r.count} são demonstração`}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => onRemove(r.key)} className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label={`Remover ${r.name}`}>
                    <X className="size-4" />
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COLUMNS.map((c) => (
            <tr key={c.key} className="border-t">
              <th scope="row" className="sticky left-0 z-10 bg-card p-3 text-left text-xs font-medium text-muted-foreground">{c.label}</th>
              {rows.map((r) => {
                const win = best.has(c.key) && c.value(r) === best.get(c.key);
                return (
                  <td key={r.key} className={cn("p-3 whitespace-nowrap tabular-nums", win && "bg-positive/8 font-medium text-positive")}>
                    {c.show(r)}
                    {win && <span className="ml-1.5 rounded-full bg-positive px-1.5 text-[10px] leading-4 font-semibold text-white">melhor</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
