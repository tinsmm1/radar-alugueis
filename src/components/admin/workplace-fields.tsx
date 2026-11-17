"use client";
import { MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMMUTE_MODE_LABEL, COMMUTE_MODES, type CommuteMode } from "@/domain/profile";
import { cn } from "@/lib/utils";

export type WorkplaceDraft = {
  key: string;
  id?: string;
  name: string;
  address: string;
  lat: string;
  lng: string;
  mode: CommuteMode;
  departure: string;
  returnAt: string;
  days: number[];
  weight: number;
};

const DAYS: Array<[number, string]> = [[1, "Seg"], [2, "Ter"], [3, "Qua"], [4, "Qui"], [5, "Sex"], [6, "Sáb"], [7, "Dom"]];
export const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** Editor of one workplace: name, address (or coordinates), mode, ida/volta times, days and weight. */
export function WorkplaceFields({ w, index, onChange, onRemove }: { w: WorkplaceDraft; index: number; onChange: (patch: Partial<WorkplaceDraft>) => void; onRemove: () => void }) {
  const id = (s: string) => `wp-${w.key}-${s}`;
  return (
    <fieldset className="space-y-3 rounded-xl border p-4">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <MapPin className="size-4 text-primary" /> Local {index + 1}
        {w.lat && w.lng ? <span className="text-xs font-normal text-emerald-700">· localizado</span> : <span className="text-xs font-normal text-muted-foreground">· será localizado ao salvar</span>}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={id("name")}>Nome</Label>
          <Input id={id("name")} value={w.name} maxLength={60} placeholder="Trabalho da Ana" onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("mode")}>Como vai</Label>
          <select id={id("mode")} className={selectClass} value={w.mode} onChange={(e) => onChange({ mode: e.target.value as CommuteMode })}>
            {COMMUTE_MODES.map((m) => <option key={m} value={m}>{COMMUTE_MODE_LABEL[m]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={id("address")}>Endereço</Label>
          <Input id={id("address")} value={w.address} maxLength={160} placeholder="Av. Afonso Pena, 1500, Centro" onChange={(e) => onChange({ address: e.target.value, lat: "", lng: "" })} />
          <p className="text-xs text-muted-foreground">Rua, número e bairro. Fora de BH ou sem resultado? Informe as coordenadas abaixo (clique com o botão direito no Google Maps para copiar).</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          <div className="space-y-1.5">
            <Label htmlFor={id("lat")}>Latitude (opcional)</Label>
            <Input id={id("lat")} inputMode="decimal" value={w.lat} placeholder="-19.9320" onChange={(e) => onChange({ lat: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id("lng")}>Longitude (opcional)</Label>
            <Input id={id("lng")} inputMode="decimal" value={w.lng} placeholder="-43.9380" onChange={(e) => onChange({ lng: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("dep")}>Sai de casa às (ida)</Label>
          <Input id={id("dep")} type="time" value={w.departure} onChange={(e) => onChange({ departure: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("ret")}>Sai do trabalho às (volta)</Label>
          <Input id={id("ret")} type="time" value={w.returnAt} onChange={(e) => onChange({ returnAt: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Dias</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">
          {DAYS.map(([d, label]) => {
            const on = w.days.includes(d);
            return (
              <button key={d} type="button" aria-pressed={on} onClick={() => onChange({ days: on ? w.days.filter((x) => x !== d) : [...w.days, d].sort() })}
                className={cn("h-8 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-colors", on ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-muted-foreground ring-border hover:text-foreground")}>
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={id("weight")}>Importância (1 a 10)</Label>
          <Input id={id("weight")} type="number" min={1} max={10} className="w-24" value={w.weight} onChange={(e) => onChange({ weight: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRemove}><Trash2 /> Remover local</Button>
      </div>
    </fieldset>
  );
}
