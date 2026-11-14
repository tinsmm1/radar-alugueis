"use client";
import { Info, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_HELP } from "@/domain/layers";
import { MAP_LAYERS } from "@/domain/layers";
import { cn } from "@/lib/utils";
import { LEGEND, type OverlayKey } from "./overlays";
import { DEMO_FILL, PIN_RISK } from "./pins";

const GROUPS: Array<[string, string]> = [["risco", "Riscos e água"], ["urbano", "Entorno urbano"], ["limites", "Limites"]];

/** Layers popover: risk/urban overlays, bairro selection and "search this area". */
export function LayerControl({ active, onToggle, selectBairros, onSelectBairros, bboxActive, onBbox }: { active: OverlayKey[]; onToggle: (k: OverlayKey) => void; selectBairros: boolean; onSelectBairros: (v: boolean) => void; bboxActive: boolean; onBbox: (v: boolean) => void }) {
  const count = active.filter((k) => k !== "bairros").length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="bg-card shadow-sm">
          <Layers />
          Camadas
          {count > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] leading-5 text-primary-foreground">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-3">
          {GROUPS.map(([group, title]) => (
            <div key={group}>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
              <div className="space-y-1.5">
                {MAP_LAYERS.filter((l) => l.group === group).map((l) => (
                  <Label key={l.key} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                    <Checkbox checked={active.includes(l.key as OverlayKey)} onCheckedChange={() => onToggle(l.key as OverlayKey)} />
                    {l.label}
                  </Label>
                ))}
              </div>
            </div>
          ))}
          <div className="space-y-2.5 border-t pt-3">
            <Label className="flex items-center justify-between gap-2 text-sm font-normal">
              Selecionar bairros no mapa
              <Switch checked={selectBairros} onCheckedChange={onSelectBairros} />
            </Label>
            <Label className="flex items-center justify-between gap-2 text-sm font-normal">
              Buscar ao mover o mapa
              <Switch checked={bboxActive} onCheckedChange={onBbox} />
            </Label>
          </div>
          <p className="flex gap-1.5 rounded-lg bg-muted p-2 text-[11px] leading-snug text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" />
            {CATEGORY_HELP.suscetibilidade} Áreas sem cor não significam ausência de risco.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Swatch({ color, shape }: { color: string; shape: "fill" | "line" | "dash" | "dot" }) {
  if (shape === "dot") return <span className="size-2.5 rounded-full ring-2 ring-white" style={{ background: color }} />;
  if (shape === "fill") return <span className="h-2.5 w-3.5 rounded-sm" style={{ background: color, opacity: 0.75 }} />;
  return <span className="h-0 w-4 border-t-2" style={{ borderColor: color, borderStyle: shape === "dash" ? "dashed" : "solid" }} />;
}

/** Legend: pin colours (location risk index) and every active overlay. */
export function Legend({ active, className }: { active: OverlayKey[]; className?: string }) {
  return (
    <div className={cn("max-h-[45vh] w-56 space-y-2.5 overflow-y-auto rounded-xl border bg-card/95 p-3 text-[11px] shadow-sm backdrop-blur", className)}>
      <div>
        <p className="mb-1 font-semibold">Imóveis · índice de risco</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {Object.entries(PIN_RISK).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-full border-2 bg-white" style={{ borderColor: v.color }} />
              {v.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-full border-2 border-dashed border-slate-400 bg-white" />
            Aproximado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-full border-2 border-slate-400" style={{ background: DEMO_FILL }} />
            Demonstração
          </span>
        </div>
      </div>
      {active.map((k) => (
        <div key={k}>
          <p className="font-semibold">
            {LEGEND[k].title}
            {LEGEND[k].note && <span className="font-normal text-muted-foreground"> · {LEGEND[k].note}</span>}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {LEGEND[k].entries.map((e) => (
              <span key={e.label} className="flex items-center gap-1.5">
                <Swatch color={e.color} shape={e.shape} />
                {e.label}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
