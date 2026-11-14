"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, pctBp } from "@/domain/money";
import { removePriceWatch, setPriceWatch } from "@/server/actions/watches";

type Watch = { targetCents: number | null; startPriceCents: number | null; notifiedAt: Date | null; createdAt: Date };

/**
 * Follow the price of this property in the current mode, optionally with a target: the owner is
 * notified (app, e-mail, Telegram) on every drop and when the price reaches the target.
 */
export function PriceWatch({ propertyId, mode, currentCents, watch }: { propertyId: number; mode: "aluguel" | "compra"; currentCents: number | null; watch: Watch | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(watch?.targetCents != null ? String(watch.targetCents / 100) : "");
  const unit = mode === "compra" ? "" : "/mês";
  const change = watch?.startPriceCents && currentCents != null && currentCents !== watch.startPriceCents ? Math.round(((currentCents - watch.startPriceCents) / watch.startPriceCents) * 10_000) : null;

  const save = () =>
    start(async () => {
      const digits = value.replace(/\D/g, "");
      const res = await setPriceWatch({ propertyId, mode, target: digits ? Number(digits) : null });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.reached ? "O preço já está no seu alvo: veja as notificações" : digits ? "Preço-alvo salvo. Você será avisado." : "Acompanhando quedas de preço.");
      router.refresh();
    });
  const remove = () =>
    start(async () => {
      const res = await removePriceWatch(propertyId, mode);
      if (!res.ok) return void toast.error(res.error);
      setValue("");
      toast.success("Acompanhamento removido");
      router.refresh();
    });

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <BellRing className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Acompanhar preço {mode === "compra" ? "de venda" : "do aluguel"}</h2>
      </div>
      {watch ? (
        <p className="text-xs text-muted-foreground">
          Acompanhando desde {new Date(watch.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}{watch.startPriceCents != null && <> (era {brl(watch.startPriceCents)}{unit})</>}.
          {change != null && <b className={change < 0 ? " text-emerald-700" : " text-foreground"}> {change < 0 ? "Caiu" : "Subiu"} {pctBp(Math.abs(change))} desde então.</b>}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Receba um aviso a cada redução e quando o preço chegar ao seu alvo (no app, por e-mail ou Telegram).</p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`alvo-${mode}`} className="text-xs">Preço-alvo {mode === "compra" ? "(R$)" : "do custo mensal (R$/mês)"} · opcional</Label>
        <div className="flex gap-2">
          <Input id={`alvo-${mode}`} inputMode="numeric" placeholder={currentCents != null ? `ex.: ${Math.round((currentCents * 0.9) / 100).toLocaleString("pt-BR")}` : "valor"} value={value} onChange={(e) => setValue(e.target.value)} className="h-9" />
          <Button size="sm" onClick={save} disabled={pending} className="h-9">
            <Target />
            {watch ? "Atualizar" : "Acompanhar"}
          </Button>
        </div>
        {watch?.targetCents != null && (
          <p className="text-[11px] text-muted-foreground">
            Alvo atual: {brl(watch.targetCents)}{unit}
            {watch.notifiedAt && ` · atingido em ${new Date(watch.notifiedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
          </p>
        )}
      </div>
      {watch && (
        <button type="button" onClick={remove} disabled={pending} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          Parar de acompanhar
        </button>
      )}
    </div>
  );
}
