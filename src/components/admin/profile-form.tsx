"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCoordinate, parseCoordinatePair } from "@/domain/geo";
import { WEIGHT_KEYS, WEIGHT_LABEL, type Profile, type WeightKey } from "@/domain/profile";
import { recalcProfileNow, saveProfile } from "@/server/actions/profile";
import { WorkplaceFields, type WorkplaceDraft } from "./workplace-fields";

const reais = (cents: number | null) => (cents == null ? "" : String(cents / 100));
const cents = (v: string) => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : Math.round(n * 100);
};
/** Decimal ("-19.98") or degrees ("19°59'00.8\"S"), as copied from Google Maps. */
const coord = (v: string) => parseCoordinate(v);
let seq = 0;
const draftOf = (w: Profile["workplaces"][number]): WorkplaceDraft => ({ key: w.id, id: w.id, name: w.name, address: w.address, lat: w.lat == null ? "" : String(w.lat), lng: w.lng == null ? "" : String(w.lng), mode: w.mode, departure: w.departure, returnAt: w.returnAt, days: w.days, weight: w.weight });
const blank = (): WorkplaceDraft => ({ key: `novo-${++seq}`, name: "", address: "", lat: "", lng: "", mode: "carro", departure: "08:00", returnAt: "18:00", days: [1, 2, 3, 4, 5], weight: 5 });

function Money({ id, label, value, onChange, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="decimal" value={value} placeholder="R$" onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Administração → Perfil e trabalho: workplaces and times, commute costs, finances and grade weights. */
export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [recalc, startRecalc] = useTransition();
  const [wps, setWps] = useState<WorkplaceDraft[]>(profile.workplaces.map(draftOf));
  const [maxCommute, setMaxCommute] = useState(String(profile.maxCommuteMin));
  const [hour, setHour] = useState(reais(profile.hourValueCents));
  const [km, setKm] = useState(reais(profile.carCostPerKmCents));
  const [parking, setParking] = useState(reais(profile.parkingPerDayCents));
  const [fare, setFare] = useState(reais(profile.transitFareCents));
  const [income, setIncome] = useState(reais(profile.monthlyIncomeCents));
  const [savings, setSavings] = useState(reais(profile.savingsCents));
  const [maxPct, setMaxPct] = useState(String(profile.maxInstallmentPct));
  const [weights, setWeights] = useState<Record<WeightKey, number>>(profile.weights);
  const [alerts, setAlerts] = useState(profile.alerts);
  const [alertGrade, setAlertGrade] = useState<"A" | "B">(profile.alertGrade);
  const total = WEIGHT_KEYS.reduce((s, k) => s + weights[k], 0);

  const submit = () =>
    startSave(async () => {
      const res = await saveProfile({
        workplaces: wps.map((w) => ({ id: w.id, name: w.name, address: w.address, lat: parseCoordinatePair(w.lat)?.lat ?? coord(w.lat), lng: parseCoordinatePair(w.lat)?.lng ?? coord(w.lng), mode: w.mode, departure: w.departure, returnAt: w.returnAt, days: w.days, weight: w.weight })),
        maxCommuteMin: Number(maxCommute) || 45,
        hourValueCents: cents(hour) ?? 0,
        carCostPerKmCents: cents(km) ?? 0,
        parkingPerDayCents: cents(parking) ?? 0,
        transitFareCents: cents(fare) ?? 0,
        monthlyIncomeCents: cents(income),
        savingsCents: cents(savings),
        maxInstallmentPct: Number(maxPct) || 30,
        weights,
        alerts,
        alertGrade,
      });
      if (!res.ok) return void toast.error(res.error);
      setWps((cur) => cur.map((w, i) => ({ ...w, id: res.data.workplaces[i]?.id, lat: String(res.data.workplaces[i]?.lat ?? ""), lng: String(res.data.workplaces[i]?.lng ?? "") })));
      toast.success("Perfil salvo. Deslocamentos e notas estão sendo recalculados em segundo plano (o que faltar segue na próxima coleta).");
      router.refresh();
    });
  const recalculate = () =>
    startRecalc(async () => {
      const res = await recalcProfileNow();
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${res.data.commutes} deslocamentos calculados${res.data.remaining ? " (o restante segue na próxima coleta)" : ""}; notas atualizadas.`);
      router.refresh();
    });

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="space-y-3">
        {wps.map((w, i) => (
          <WorkplaceFields key={w.key} w={w} index={i} onChange={(patch) => setWps((cur) => cur.map((x) => (x.key === w.key ? { ...x, ...patch } : x)))} onRemove={() => setWps((cur) => cur.filter((x) => x.key !== w.key))} />
        ))}
        {wps.length < 4 && <Button type="button" variant="outline" onClick={() => setWps((cur) => [...cur, blank()])}><Plus /> Adicionar local de trabalho ou estudo</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="p-max">Tempo máximo aceitável (min, só ida)</Label>
          <Input id="p-max" type="number" min={10} max={180} value={maxCommute} onChange={(e) => setMaxCommute(e.target.value)} />
        </div>
        <Money id="p-hour" label="Quanto vale 1 hora sua (R$)" value={hour} onChange={setHour} hint="Entra no custo real mensal. 0 para ignorar." />
        <Money id="p-km" label="Carro: custo por km (R$)" value={km} onChange={setKm} hint="Combustível + desgaste." />
        <Money id="p-park" label="Carro: estacionamento por dia (R$)" value={parking} onChange={setParking} />
        <Money id="p-fare" label="Ônibus/metrô: tarifa (R$)" value={fare} onChange={setFare} hint="BH 2026: R$ 6,25 ônibus; R$ 6,00 metrô." />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Money id="p-income" label="Renda familiar mensal bruta (R$)" value={income} onChange={setIncome} hint="Opcional. Usada para dizer se o imóvel cabe no orçamento." />
        <Money id="p-savings" label="Reserva disponível para a compra (R$)" value={savings} onChange={setSavings} hint="Entrada + ITBI + cartório." />
        <div className="space-y-1.5">
          <Label htmlFor="p-pct">Parcela máxima (% da renda)</Label>
          <Input id="p-pct" type="number" min={10} max={50} value={maxPct} onChange={(e) => setMaxPct(e.target.value)} />
          <p className="text-xs text-muted-foreground">Bancos costumam aceitar até 30%.</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Peso de cada critério na nota <span className="font-normal text-muted-foreground">(soma {total}; o Radar normaliza para 100)</span></p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {WEIGHT_KEYS.map((k) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`p-w-${k}`} className="text-xs">{WEIGHT_LABEL[k]}</Label>
              <Input id={`p-w-${k}`} type="number" min={0} max={100} value={weights[k]} onChange={(e) => setWeights((cur) => ({ ...cur, [k]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))} />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">O risco geográfico continua fora da nota (aparece sempre ao lado). Sem locais cadastrados, o peso do deslocamento é redistribuído.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={alerts} onChange={(e) => setAlerts(e.target.checked)} />
          Avisar quando surgir oportunidade para o meu perfil
        </label>
        <select aria-label="Nota mínima do aviso" className="h-8 rounded-md border bg-transparent px-2 text-sm" value={alertGrade} disabled={!alerts} onChange={(e) => setAlertGrade(e.target.value as "A" | "B")}>
          <option value="B">nota B ou melhor</option>
          <option value="A">só nota A</option>
        </select>
        <p className="w-full text-xs text-muted-foreground">Imóveis novos (últimos 7 dias), dentro do seu tempo máximo e do seu orçamento. Um aviso por imóvel, no app, por e-mail e Telegram.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Salvar perfil</Button>
        <Button type="button" variant="outline" disabled={recalc || saving} onClick={recalculate}>{recalc ? <Loader2 className="animate-spin" /> : <RefreshCw />} Recalcular agora</Button>
      </div>
    </form>
  );
}
