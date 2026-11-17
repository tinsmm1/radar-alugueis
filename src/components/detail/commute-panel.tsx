import Link from "next/link";
import { Briefcase, Clock, Info } from "lucide-react";
import { COMMUTE_NOTE, type CommuteSummary, type Trip } from "@/domain/commute";
import { brl } from "@/domain/money";
import { COMMUTE_MODE_LABEL } from "@/domain/profile";
import { cn } from "@/lib/utils";

const METHOD_LABEL = { tomtom: "trânsito TomTom", modelo: "modelo BH" } as const;

function TripCell({ t, limit }: { t: Trip; limit: number }) {
  return (
    <div>
      <p className={cn("text-lg font-semibold tabular-nums", t.minutes > limit ? "text-amber-700" : "text-foreground")}>{t.minutes} min</p>
      <p className="text-xs text-muted-foreground">
        {t.direction === "ida" ? "Ida" : "Volta"} às {t.at} · {t.minMinutes}–{t.maxMinutes} min · {t.distanceKm.toLocaleString("pt-BR")} km
        {t.freeFlowMinutes != null && t.mode === "carro" && <> · sem trânsito {t.freeFlowMinutes} min</>}
        <span className="ml-1 rounded bg-muted px-1 py-px text-[10px]">{METHOD_LABEL[t.method]}</span>
      </p>
    </div>
  );
}

/**
 * "Deslocamento até o trabalho": trips at the owner's own times, monthly hours, money and the
 * real monthly cost of living there (housing + commute money + value of the time).
 */
export function CommutePanel({ summary, quick, hasProfile, maxCommuteMin, housingMonthlyCents, housingLabel }: { summary: CommuteSummary | null; quick: boolean; hasProfile: boolean; maxCommuteMin: number; housingMonthlyCents: number | null; housingLabel: string }) {
  if (!hasProfile) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Cadastre onde você trabalha ou estuda e seus horários em <Link href="/admin/perfil" className="font-medium text-primary hover:underline">Administração → Perfil e trabalho</Link> para ver o tempo de ida e volta no horário de pico, o custo do deslocamento e a nota ajustada ao seu dia a dia.
      </p>
    );
  }
  if (!summary) return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Este imóvel ainda não tem localização no mapa; o deslocamento será calculado depois da geocodificação.</p>;
  const realCost = housingMonthlyCents != null ? housingMonthlyCents + summary.monthlyCostCents + summary.monthlyTimeCostCents : null;
  return (
    <div className="space-y-4">
      {quick && <p className="flex gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" />Estimativa rápida pelo modelo. A próxima coleta calcula com trânsito do horário (se a chave TomTom estiver configurada) e atualiza a nota.</p>}
      <ul className="space-y-3">
        {summary.workplaces.map((w) => (
          <li key={w.workplaceId} className="rounded-xl border p-3">
            <p className="mb-2 flex flex-wrap items-center gap-x-2 text-sm font-medium">
              <Briefcase className="size-4 text-primary" /> {w.name}
              <span className="text-xs font-normal text-muted-foreground">{COMMUTE_MODE_LABEL[w.mode]} · {w.daysPerWeek}× por semana</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <TripCell t={w.ida} limit={maxCommuteMin} />
              <TripCell t={w.volta} limit={maxCommuteMin} />
              <div>
                <p className="text-lg font-semibold tabular-nums">{w.monthlyHours.toLocaleString("pt-BR")} h/mês</p>
                <p className="text-xs text-muted-foreground">{w.monthlyCostCents ? `${brl(w.monthlyCostCents)}/mês em transporte` : "Sem custo de transporte"}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <dl className="grid gap-3 rounded-xl bg-muted/40 p-3 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Média só ida</dt><dd className="font-semibold"><Clock className="mr-1 inline size-3.5" />{summary.avgOneWayMin} min</dd></div>
        <div><dt className="text-xs text-muted-foreground">Transporte</dt><dd className="font-semibold">{brl(summary.monthlyCostCents)}/mês</dd></div>
        <div><dt className="text-xs text-muted-foreground">Valor do tempo</dt><dd className="font-semibold">{brl(summary.monthlyTimeCostCents)}/mês</dd></div>
        <div><dt className="text-xs text-muted-foreground">Custo real de morar aqui</dt><dd className="font-semibold">{realCost == null ? "—" : `${brl(realCost)}/mês`}</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">Custo real = {housingLabel} + transporte + horas no trânsito × valor da sua hora. {COMMUTE_NOTE}</p>
    </div>
  );
}
