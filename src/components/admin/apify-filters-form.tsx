"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BH_REGIONAIS, COLLECT_TYPE_LABEL, COLLECT_TYPES, DEFAULT_COLLECT_FILTERS, type CollectFilters } from "@/domain/collect-filters";
import { saveApifyFilters } from "@/server/actions/apify";

const toNum = (v: string): number | null => {
  const n = Number(v.replace(/\D/g, ""));
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

function PriceRange({ id, label, min, max, onChange }: { id: string; label: string; min: number | null; max: number | null; onChange: (min: number | null, max: number | null) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-min`}>{label} (R$)</Label>
      <div className="flex items-center gap-2">
        <Input id={`${id}-min`} inputMode="numeric" placeholder="mínimo" value={min ?? ""} onChange={(e) => onChange(toNum(e.target.value), max)} />
        <span className="text-muted-foreground text-sm">a</span>
        <Input id={`${id}-max`} inputMode="numeric" placeholder="máximo" aria-label={`${label} máximo`} value={max ?? ""} onChange={(e) => onChange(min, toNum(e.target.value))} />
      </div>
    </div>
  );
}

/** Filters sent to the Apify robots (they charge only for matching listings) and checked again on import. */
export function ApifyFiltersForm({ initial, summary }: { initial: CollectFilters; summary: string }) {
  const [f, setF] = useState<CollectFilters>(initial);
  const [saving, start] = useTransition();
  const router = useRouter();
  const set = (patch: Partial<CollectFilters>) => setF((cur) => ({ ...cur, ...patch }));
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = (next: CollectFilters | null) =>
    start(async () => {
      const res = await saveApifyFilters(next);
      if (!res.ok) return void toast.error(res.error);
      if (next == null) setF(DEFAULT_COLLECT_FILTERS);
      toast.success(`Filtros salvos. Valem a partir da próxima execução do robô. ${res.data.summary}`);
      router.refresh();
    });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save(f);
      }}
    >
      <p className="bg-muted/50 rounded-lg p-3 text-sm">
        <span className="font-medium">Em uso:</span> {summary}
      </p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tipo de imóvel</legend>
        <div className="flex flex-wrap gap-4">
          {COLLECT_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <Checkbox checked={f.tipos.includes(t)} onCheckedChange={() => set({ tipos: toggle(f.tipos, t) })} />
              {COLLECT_TYPE_LABEL[t]}
            </label>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">Salas, conjuntos, lojas, terrenos e outros imóveis comerciais nunca são coletados.</p>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-3">
        <PriceRange id="aluguel" label="Aluguel" min={f.aluguelMin} max={f.aluguelMax} onChange={(aluguelMin, aluguelMax) => set({ aluguelMin, aluguelMax })} />
        <PriceRange id="venda" label="Preço de venda" min={f.vendaMin} max={f.vendaMax} onChange={(vendaMin, vendaMax) => set({ vendaMin, vendaMax })} />
        <div className="space-y-1.5">
          <Label htmlFor="quartos">Quartos (mínimo)</Label>
          <Input id="quartos" inputMode="numeric" placeholder="qualquer" value={f.quartosMin ?? ""} onChange={(e) => set({ quartosMin: Math.min(10, toNum(e.target.value) ?? 0) || null })} />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Regionais de BH</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {BH_REGIONAIS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <Checkbox checked={f.regionais.includes(r)} onCheckedChange={() => set({ regionais: toggle(f.regionais, r) })} />
              {r}
            </label>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Nenhuma marcada = BH inteira. O robô não filtra por regional: ele busca a cidade toda e o Radar descarta os anúncios de outras regionais. Tipo, preço e quartos o robô já busca filtrado, e você só paga pelo que vier.
        </p>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Salvar filtros
        </Button>
        <Button type="button" variant="outline" disabled={saving} onClick={() => save(null)}>
          <RotateCcw />
          Voltar ao padrão (tudo)
        </Button>
      </div>
    </form>
  );
}
