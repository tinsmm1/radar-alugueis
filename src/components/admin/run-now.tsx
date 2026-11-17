"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runCollectionNow } from "@/server/actions/admin";

const STAGE_LABEL: Record<string, string> = {
  fontes: "consultando fontes",
  camadas: "atualizando camadas",
  geocodificar: "localizando endereços",
  analisar: "analisando localizações",
  deslocamento: "calculando deslocamentos até o trabalho",
  oportunidades: "calculando oportunidades",
  notificar: "enviando notificações",
  retencao: "aplicando retenção",
  concluido: "concluída",
};

/** Runs the pipeline for up to ~55 s; a long run continues on the next click or scheduled call. */
export function RunNow() {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();
  const run = () =>
    start(async () => {
      setStatus(null);
      const res = await runCollectionNow();
      if (!res.ok) return void toast.error(res.error);
      const { stage, more, note } = res.data;
      const text = more ? `Execução em andamento (${STAGE_LABEL[stage] ?? stage}${note ? `: ${note}` : ""}). Clique de novo para continuar ou aguarde o agendamento.` : "Coleta concluída.";
      setStatus(text);
      if (more) toast.info(text);
      else toast.success(text);
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <Button onClick={run} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Play />}
        {pending ? "Coletando… (até 1 min)" : "Executar coleta agora"}
      </Button>
      {status && <p className="text-xs text-muted-foreground" role="status">{status}</p>}
    </div>
  );
}
