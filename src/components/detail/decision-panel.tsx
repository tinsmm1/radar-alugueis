import Link from "next/link";
import { Handshake, Wallet } from "lucide-react";
import { AFFORDABILITY_NOTE, buyAffordability, FIT_LABEL, rentAffordability, type Fit } from "@/domain/affordability";
import { brl } from "@/domain/money";
import { LEVERAGE_LABEL, NEGOTIATION_NOTE, URGENCY_LABEL, type Negotiation } from "@/domain/negotiation";
import type { Profile } from "@/domain/profile";
import { cn } from "@/lib/utils";

const FIT_CLASS: Record<Fit, string> = {
  cabe: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  apertado: "bg-amber-50 text-amber-800 ring-amber-200",
  nao_cabe: "bg-rose-50 text-rose-800 ring-rose-200",
  sem_dados: "bg-muted text-muted-foreground ring-border",
};

const CHECKLIST = {
  compra: [
    "Matrícula atualizada (até 30 dias) no cartório de registro: proprietário, ônus, penhoras e hipotecas.",
    "Certidões do vendedor: cível, trabalhista, protestos e federal; certidão negativa de débitos de IPTU na PBH.",
    "Declaração de quitação do condomínio e últimas atas (obras e chamadas extras previstas).",
    "Habite-se e averbação da construção; área privativa da matrícula igual à anunciada.",
    "Vistoria técnica: umidade, trincas, instalações elétricas e hidráulicas, laudo de estrutura se houver dúvida.",
    "Visite no horário de pico e num dia de chuva: trânsito, barulho, alagamento da rua.",
    "Simule o financiamento em 2 ou 3 bancos (CET, não só a taxa) antes de assinar a proposta.",
  ],
  aluguel: [
    "Confira condomínio, IPTU e taxas por escrito (o Radar marca quando o custo é parcial).",
    "Vistoria de entrada com fotos datadas de cada cômodo.",
    "Garantia: compare caução, seguro-fiança e título de capitalização (custo e devolução).",
    "Leia multa de rescisão, reajuste (índice) e quem paga cada manutenção.",
    "Visite no horário em que você vai sair para o trabalho e num dia de chuva.",
  ],
} as const;

/** "Negociação e decisão": offer plan, whether it fits the household and a due-diligence checklist. */
export function DecisionPanel({ mode, negotiation, profile, priceCents, condoCents, iptuMonthlyCents, totalCents, commuteCostCents }: {
  mode: "aluguel" | "compra"; negotiation: Negotiation | null; profile: Profile; priceCents: number | null; condoCents: number | null; iptuMonthlyCents: number | null; totalCents: number | null; commuteCostCents: number | null;
}) {
  const buy = mode === "compra";
  const fitBuy = buy && priceCents != null ? buyAffordability(priceCents, condoCents, iptuMonthlyCents, profile) : null;
  const fitRent = !buy ? rentAffordability(totalCents, commuteCostCents, profile) : null;
  const fit = fitBuy?.fit ?? fitRent?.fit ?? "sem_dados";
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-medium"><Handshake className="size-4 text-primary" /> Plano de proposta</h3>
        {negotiation ? (
          <>
            <div className="mb-2 flex flex-wrap gap-1.5 text-[11px] font-medium">
              <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">{LEVERAGE_LABEL[negotiation.leverage]} · ~{negotiation.discountPct.toLocaleString("pt-BR")}%</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{URGENCY_LABEL[negotiation.urgency]}</span>
            </div>
            <dl className="grid grid-cols-3 gap-2 rounded-xl border p-3 text-center text-sm">
              <div><dt className="text-xs text-muted-foreground">Abrir com</dt><dd className="font-semibold">{brl(negotiation.openingCents)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Meta</dt><dd className="font-semibold text-emerald-700">{brl(negotiation.targetCents)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Teto</dt><dd className="font-semibold">{brl(negotiation.ceilingCents)}</dd></div>
            </dl>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{negotiation.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            <p className="mt-2 text-xs text-muted-foreground">{buy ? "Valores do preço pedido." : "Valores do aluguel (condomínio e IPTU raramente são negociáveis)."} {NEGOTIATION_NOTE}</p>
          </>
        ) : <p className="text-sm text-muted-foreground">O plano de proposta aparece depois da próxima coleta.</p>}
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-medium"><Wallet className="size-4 text-primary" /> Cabe no orçamento?</h3>
        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", FIT_CLASS[fit])}>{FIT_LABEL[fit]}</span>
        {fit === "sem_dados" ? (
          <p className="mt-2 text-sm text-muted-foreground">Informe renda e reserva em <Link href="/admin/perfil" className="text-primary hover:underline">Perfil e trabalho</Link>.</p>
        ) : fitBuy ? (
          <div className="mt-2 space-y-1 text-sm">
            <p>Dinheiro na assinatura: <b>{brl(fitBuy.upfrontCents)}</b>{fitBuy.savingsGapCents != null && fitBuy.savingsGapCents > 0 && <> · faltam <b>{brl(fitBuy.savingsGapCents)}</b></>}</p>
            <p>Primeira parcela (SAC): <b>{brl(fitBuy.firstInstallmentCents)}</b> · moradia no 1º mês: <b>{brl(fitBuy.housingMonthlyCents)}</b></p>
            {fitBuy.maxPriceCents != null && <p>Preço máximo para o seu perfil hoje: <b>{brl(fitBuy.maxPriceCents)}</b> (limitado pela {fitBuy.limitedBy}).</p>}
            <ul className="list-disc pl-5 text-muted-foreground">{fitBuy.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        ) : fitRent ? (
          <p className="mt-2 text-sm">Custo conhecido = <b>{fitRent.pctOfIncome?.toLocaleString("pt-BR")}%</b> da renda{fitRent.withCommutePct != null && <>; com transporte, <b>{fitRent.withCommutePct.toLocaleString("pt-BR")}%</b></>}. Referência usual: até {profile.maxInstallmentPct}%.</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">{AFFORDABILITY_NOTE}</p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Antes de fechar</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm">{CHECKLIST[mode].map((c) => <li key={c}>{c}</li>)}</ol>
      </div>
    </div>
  );
}
