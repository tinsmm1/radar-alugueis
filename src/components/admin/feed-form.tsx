"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/domain/money";
import { addFeed, testFeed } from "@/server/actions/admin";

type Preview = { provider: string | null; count: number; skipped: Record<string, number>; sample: Array<{ title: string | null; neighborhood: string | null; rentCents: number | null }> };

/** Registers an authorized VRSync feed (with a test that parses it without storing). */
export function FeedForm() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [testing, startTest] = useTransition();
  const [saving, startSave] = useTransition();
  const router = useRouter();

  const test = () =>
    startTest(async () => {
      setPreview(null);
      const res = await testFeed(url);
      if (!res.ok) return void toast.error(res.error);
      setPreview(res.data);
      toast.success(`Feed válido: ${res.data.count} anúncios (aluguel e venda) em BH.`);
    });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      const res = await addFeed({ name, url, authorization, confirm: confirm as true });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Fonte cadastrada. Ela será coletada na próxima execução.");
      setName("");
      setUrl("");
      setAuthorization("");
      setConfirm(false);
      setPreview(null);
      router.refresh();
    });
  };

  return (
    <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="feed-name">Nome da fonte</Label>
        <Input id="feed-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Imobiliária Exemplo" required maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="feed-url">Endereço do feed VRSync (XML)</Label>
        <Input id="feed-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/feed.xml" required />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="feed-auth">Autorização</Label>
        <Textarea id="feed-auth" value={authorization} onChange={(e) => setAuthorization(e.target.value)} placeholder="Quem autorizou, quando e como (ex.: e-mail de Fulana, gerente da imobiliária, em 10/11/2026)." required maxLength={500} rows={2} />
      </div>
      <label className="flex items-start gap-2.5 text-sm md:col-span-2">
        <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} className="mt-0.5" />
        <span>Tenho autorização da imobiliária para usar este feed. O Radar não coleta portais cujos termos proíbem coleta automática.</span>
      </label>
      {preview && (
        <div className="rounded-lg border bg-accent/40 p-3 text-sm md:col-span-2">
          <p className="font-medium">
            {preview.provider ?? "Feed"}: {preview.count} anúncios (aluguel e venda) em Belo Horizonte
          </p>
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
        <Button type="button" variant="outline" onClick={test} disabled={testing || !url}>
          {testing ? <Loader2 className="animate-spin" /> : <FlaskConical />}
          Testar feed
        </Button>
        <Button type="submit" disabled={saving || !confirm}>
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          Cadastrar fonte
        </Button>
      </div>
    </form>
  );
}
