"use client";
import { useState } from "react";
import { Check, ChevronsUpDown, Crosshair, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { normalizeText } from "@/domain/text";
import { cn } from "@/lib/utils";
import { Chip } from "./fields";

export type Facet = { name: string; count: number };

/** Multi-select of neighbourhoods with listing counts (search inside, selected first). */
export function BairroPicker({ options, selected, onToggle, onClear }: { options: Facet[]; selected: string[]; onToggle: (name: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const isOn = (name: string) => selected.some((s) => normalizeText(s) === normalizeText(name));
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="h-8 w-full justify-between px-2.5 text-sm font-normal">
            <span className={cn("truncate", !selected.length && "text-muted-foreground")}>{selected.length ? `${selected.length} bairro${selected.length > 1 ? "s" : ""} selecionado${selected.length > 1 ? "s" : ""}` : "Escolher bairros"}</span>
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
          <Command filter={(value, search) => (normalizeText(value).includes(normalizeText(search)) ? 1 : 0)}>
            <CommandInput placeholder="Buscar bairro…" />
            <CommandList className="max-h-72">
              <CommandEmpty>Nenhum bairro com imóveis.</CommandEmpty>
              <CommandGroup>
                {[...options].sort((a, b) => Number(isOn(b.name)) - Number(isOn(a.name))).map((o) => (
                  <CommandItem key={o.name} value={o.name} onSelect={() => onToggle(o.name)}>
                    <Check className={cn("size-3.5", isOn(o.name) ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{o.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{o.count}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((b) => (
            <button key={b} type="button" onClick={() => onToggle(b)} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground hover:bg-accent/70" aria-label={`Remover ${b}`}>
              {b}
              <X className="size-3" />
            </button>
          ))}
          <button type="button" onClick={onClear} className="px-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
            limpar
          </button>
        </div>
      )}
    </div>
  );
}

export function RegionalChips({ options, selected, onToggle }: { options: Facet[]; selected: string[]; onToggle: (name: string) => void }) {
  if (!options.length) return <p className="text-xs text-muted-foreground">As regionais aparecem quando os imóveis estiverem localizados.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((r) => (
        <Chip key={r.name} on={selected.includes(r.name)} onClick={() => onToggle(r.name)}>
          {r.name} <span className="opacity-60">{r.count}</span>
        </Chip>
      ))}
    </div>
  );
}

/**
 * Distance filter: an address or place in BH becomes the centre (geocoded on the server), with
 * a radius in km. "Perto de mim" uses the browser location (only on the owner's request).
 */
export function DistancePicker({ perto, pertoNome, raioKm, onChange }: { perto?: string; pertoNome?: string; raioKm?: number; onChange: (v: { perto?: string; pertoNome?: string; raioKm?: number }) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const radius = raioKm ?? 2;
  const find = async () => {
    if (text.trim().length < 3) return toast.info("Digite um endereço, bairro ou ponto de referência.");
    setBusy(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(text.trim())}`);
      const data = (await res.json()) as { lat?: number; lng?: number; label?: string; error?: string };
      if (!res.ok || data.lat == null) return toast.error(data.error ?? "Endereço não encontrado.");
      onChange({ perto: `${data.lat.toFixed(5)},${data.lng!.toFixed(5)}`, pertoNome: (data.label ?? text).slice(0, 120), raioKm: radius });
      setText("");
    } catch {
      toast.error("Não foi possível buscar o endereço agora.");
    } finally {
      setBusy(false);
    }
  };
  const nearMe = () => {
    if (!navigator.geolocation) return toast.error("Este navegador não informa a localização.");
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ perto: `${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`, pertoNome: "minha localização", raioKm: radius }),
      () => toast.error("Localização não autorizada."),
      { timeout: 10_000 },
    );
  };
  return (
    <div className="space-y-2.5">
      {perto ? (
        <div className="flex items-center gap-2 rounded-lg border bg-accent/50 px-2.5 py-1.5 text-xs">
          <MapPin className="size-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate" title={pertoNome}>{pertoNome ?? "Ponto escolhido"}</span>
          <button type="button" onClick={() => onChange({ perto: undefined, pertoNome: undefined, raioKm: undefined })} aria-label="Remover ponto de referência" className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void find())} placeholder="Ex.: Praça da Liberdade, UFMG" className="h-8 text-sm" aria-label="Endereço ou ponto de referência" />
          <Button type="button" size="sm" variant="secondary" onClick={() => void find()} disabled={busy} className="h-8">
            {busy ? <Loader2 className="animate-spin" /> : "Ok"}
          </Button>
          <Button type="button" size="icon-sm" variant="outline" onClick={nearMe} aria-label="Perto de mim" title="Perto de mim" className="size-8">
            <Crosshair />
          </Button>
        </div>
      )}
      <div className={cn("space-y-1.5", !perto && "opacity-50")}>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Raio</span>
          <span className="font-medium text-foreground tabular-nums">{radius.toLocaleString("pt-BR")} km</span>
        </div>
        <Slider min={0.5} max={10} step={0.5} value={[radius]} disabled={!perto} onValueCommit={([v]) => onChange({ perto, pertoNome, raioKm: v })} aria-label="Raio da busca em km" />
      </div>
    </div>
  );
}
