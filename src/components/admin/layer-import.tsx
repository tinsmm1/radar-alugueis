"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_HELP, CATEGORY_LABEL } from "@/domain/layers";
import { importLayer } from "@/server/actions/admin";

const select = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const CATEGORIES = ["risco_mapeado", "suscetibilidade", "ocorrencia_historica"] as const;

/** Upload of an official layer (PBH, Defesa Civil) as GeoJSON in WGS84. */
export function LayerImport() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = (fd: FormData) =>
    start(async () => {
      const res = await importLayer(fd);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Camada importada: ${res.data.count} feições. Os imóveis serão reanalisados na próxima coleta.`);
      router.refresh();
    });
  return (
    <form action={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="l-title">Nome da camada</Label>
        <Input id="l-title" name="title" required minLength={3} maxLength={120} placeholder="Ex.: Áreas de risco geológico (Urbel)" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-cat">Tipo de informação</Label>
        <select id="l-cat" name="category" className={select} defaultValue="risco_mapeado">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-src">Fonte oficial</Label>
        <Input id="l-src" name="source" required minLength={3} maxLength={200} placeholder="Ex.: Prefeitura de Belo Horizonte / Urbel" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-url">Link da fonte</Label>
        <Input id="l-url" name="sourceUrl" type="url" placeholder="https://…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-date">Data ou ano dos dados</Label>
        <Input id="l-date" name="sourceDate" maxLength={40} placeholder="Ex.: 2024" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-file">Arquivo GeoJSON (WGS84)</Label>
        <Input id="l-file" name="file" type="file" accept=".geojson,.json,application/geo+json,application/json" required />
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground sm:col-span-2">
        {CATEGORIES.map((c) => (
          <li key={c}>
            <b>{CATEGORY_LABEL[c]}:</b> {CATEGORY_HELP[c]}
          </li>
        ))}
      </ul>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Upload />}
          {pending ? "Importando…" : "Importar camada"}
        </Button>
      </div>
    </form>
  );
}
