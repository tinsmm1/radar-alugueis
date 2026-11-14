import { Bath, BedDouble, Car, DoorOpen, Home, Ruler } from "lucide-react";
import { FEATURE_LABEL, FEATURES, TYPE_LABEL, type Feature, type PropertyType } from "@/domain/listing";
import { m2 } from "@/domain/money";
import type { PropertyRow } from "@/server/queries/property";
import { cn } from "@/lib/utils";

/** Physical data sheet and the 18 special features (present ones highlighted). */
export function FactsGrid({ p }: { p: PropertyRow }) {
  const facts = [
    { icon: Home, label: "Tipo", value: p.type ? TYPE_LABEL[p.type as PropertyType] : "Não informado" },
    { icon: Ruler, label: "Área privativa", value: m2(p.areaM2) },
    { icon: BedDouble, label: "Quartos", value: p.bedrooms ?? "—" },
    { icon: DoorOpen, label: "Suítes", value: p.suites ?? "—" },
    { icon: Bath, label: "Banheiros", value: p.bathrooms ?? "—" },
    { icon: Car, label: "Vagas", value: p.parking ?? "—" },
  ];
  const present = new Set(p.features);
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {facts.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <Icon className="size-5 text-primary" aria-hidden />
            <div>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Características</h3>
        <ul className="flex flex-wrap gap-1.5">
          {FEATURES.filter((f) => present.has(f)).map((f) => (
            <li key={f} className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">{FEATURE_LABEL[f]}</li>
          ))}
          {FEATURES.filter((f) => !present.has(f)).map((f: Feature) => (
            <li key={f} className={cn("rounded-full px-2.5 py-1 text-xs text-muted-foreground/70 line-through decoration-muted-foreground/30")} title="Não informado pela fonte">{FEATURE_LABEL[f]}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">Riscados: não informados nos anúncios (podem existir mesmo assim).</p>
      </div>
    </div>
  );
}
