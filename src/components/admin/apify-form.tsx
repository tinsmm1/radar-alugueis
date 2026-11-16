"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/domain/money";
import { addApifySource, testApifyTask } from "@/server/actions/apify";

type Preview = { count: number; planNote: string; skipped: Record<string, number>; sample: Array<{ title: string | null; neighborhood: string | null; rentCents: number | null }> };

/** Registers an Apify task (a portal scraper configured in the Apify console) as a scheduled source. */
export function ApifyForm({ hasToken }: { hasToken: boolean }) {
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [testing, startTest] = useTransition();
  const [saving, startSave] = useTransition();
  const router = useRouter();

  const test = () =>
    startTest(async () => {
      setPreview(null);
      const res = await testApifyTask(task);
      if (!res.ok) return void toast.error(res.error);
      setPreview(res.data);
      toast.success(`${res.data.count} anúncios de BH na última execução da tarefa.`);
    });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      const res = await addApifySource({ name, task, confirm: confirm as true });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.note ?? "Fonte cadastrada. Ela será lida na próxima coleta (06h e 18h).");
      setName("");
      setTask("");
      setConfirm(false);
      setPreview(null);
      router.refresh();
    });
  };

  return (
    <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
      {!hasToken && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm md:col-span-2">
          Falta a variável <code>APIFY_TOKEN</code>. Crie uma conta em apify.com, copie o token em Settings → API &amp; Integrations e cadastre-o na Vercel (ou no <code>.env.local</code>).
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="apify-name">Nome da fonte</Label>
        <Input id="apify-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: ZAP Imóveis (Apify)" required maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="apify-task">Tarefa do Apify (ID ou link)</Label>
        <Input id="apify-task" value={task} onChange={(e) => setTask(e.target.value)} placeholder="usuario~zap-aluguel-bh" required maxLength={300} />
      </div>
      <label className="flex items-start gap-2.5 text-sm md:col-span-2">
        <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} className="mt-0.5" />
        <span>Entendo que os termos de uso dos portais não autorizam coleta automática, que o robô pode parar de funcionar sem aviso e que uso estes dados só para mim.</span>
      </label>
      {preview && (
        <div className="rounded-lg border bg-accent/40 p-3 text-sm md:col-span-2">
          <p className="font-medium">{preview.count} anúncios (aluguel e venda) em Belo Horizonte na última execução</p>
          <p>{preview.planNote}</p>
          {Object.keys(preview.skipped).length > 0 && (
            <p className="text-muted-foreground">
              Ignorados: {Object.entries(preview.skipped).map(([why, n]) => `${n} ${why}`).join(" · ")}
            </p>
          )}
          <ul className="mt-2 space-y-0.5 text-muted-foreground">
            {preview.sample.map((s, i) => (
              <li key={i} className="truncate">
                {s.title ?? "Sem título"} · {s.neighborhood ?? "bairro não informado"} · {brl(s.rentCents)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button type="button" variant="outline" onClick={test} disabled={testing || !task || !hasToken}>
          {testing ? <Loader2 className="animate-spin" /> : <FlaskConical />}
          Testar tarefa
        </Button>
        <Button type="submit" disabled={saving || !confirm}>
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          Cadastrar fonte
        </Button>
      </div>
    </form>
  );
}
