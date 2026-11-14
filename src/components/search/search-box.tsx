"use client";
import { useMemo, useRef, useState } from "react";
import { Building, MapPin, Navigation, Search, X } from "lucide-react";
import { toast } from "sonner";
import { normalizeText } from "@/domain/text";
import { cn } from "@/lib/utils";
import type { Facet } from "./location-pickers";
import { useFilterNav } from "./use-filter-nav";

type Suggestion = { kind: "bairro" | "regional" | "texto" | "perto"; label: string; hint?: string };

/**
 * Main search field: neighbourhood or regional (becomes a location filter), free text (title,
 * street, advertiser) or "perto de" an address (distance filter, geocoded on the server).
 */
export function SearchBox({ bairros, regionais }: { bairros: Facet[]; regionais: Facet[] }) {
  const { filter, update } = useFilterNav();
  const [text, setText] = useState(filter.q ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const suggestions = useMemo<Suggestion[]>(() => {
    const t = normalizeText(text);
    if (t.length < 2) return [];
    const match = (name: string) => normalizeText(name).includes(t);
    return [
      ...regionais.filter((r) => match(r.name)).slice(0, 2).map((r) => ({ kind: "regional" as const, label: r.name, hint: `Regional · ${r.count} imóveis` })),
      ...bairros.filter((b) => match(b.name)).slice(0, 5).map((b) => ({ kind: "bairro" as const, label: b.name, hint: `Bairro · ${b.count} imóveis` })),
      { kind: "texto" as const, label: text.trim(), hint: "Buscar no título, rua e anunciante" },
      { kind: "perto" as const, label: text.trim(), hint: "Imóveis até 2 km deste endereço" },
    ];
  }, [text, bairros, regionais]);

  const choose = async (s: Suggestion) => {
    setOpen(false);
    if (s.kind === "bairro") {
      setText("");
      update({ bairros: [...new Set([...filter.bairros, s.label])], q: undefined });
    } else if (s.kind === "regional") {
      setText("");
      update({ regionais: [...new Set([...filter.regionais, s.label])], q: undefined });
    } else if (s.kind === "texto") update({ q: s.label || undefined });
    else {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(s.label)}`);
      const data = (await res.json()) as { lat?: number; lng?: number; label?: string; error?: string };
      if (!res.ok || data.lat == null) return toast.error(data.error ?? "Endereço não encontrado.");
      setText("");
      update({ perto: `${data.lat.toFixed(5)},${data.lng!.toFixed(5)}`, pertoNome: (data.label ?? s.label).slice(0, 120), raioKm: filter.raioKm ?? 2, q: undefined });
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Enter") {
      e.preventDefault();
      const s = open && suggestions[active] ? suggestions[active] : { kind: "texto" as const, label: text.trim() };
      void choose(s);
    }
  };

  const Icon = { bairro: MapPin, regional: Building, texto: Search, perto: Navigation };
  return (
    <div ref={box} className="relative w-full" onBlur={(e) => !box.current?.contains(e.relatedTarget as Node) && setOpen(false)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder="Bairro, endereço ou região de Belo Horizonte"
        aria-label="Buscar por bairro, endereço ou região"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls="search-suggestions"
        className="h-12 w-full rounded-xl border bg-card pr-10 pl-11 text-[15px] shadow-xs outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/15"
      />
      {(text || filter.q) && (
        <button
          type="button"
          onClick={() => {
            setText("");
            if (filter.q) update({ q: undefined });
          }} className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Limpar busca">
          <X className="size-4" />
        </button>
      )}
      {open && suggestions.length > 0 && (
        <ul id="search-suggestions" role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border bg-popover p-1 shadow-lg">
          {suggestions.map((s, i) => {
            const I = Icon[s.kind];
            return (
              <li key={`${s.kind}-${s.label}`} role="option" aria-selected={i === active}>
                <button type="button" onMouseEnter={() => setActive(i)} onClick={() => void choose(s)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm", i === active && "bg-accent")}>
                  <I className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate">{s.kind === "perto" ? `Perto de "${s.label}"` : s.kind === "texto" ? `"${s.label}"` : s.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{s.hint}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
