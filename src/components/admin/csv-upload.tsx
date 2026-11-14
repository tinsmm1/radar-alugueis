"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadCsv } from "@/server/actions/admin";

type Result = { stored: number; created: number; updated: number; unchanged: number; errors: Array<{ line: number; error: string }>; errorCount: number; located: number; analyzed: number };

export function CsvUpload() {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = (formData: FormData) =>
    start(async () => {
      setResult(null);
      const res = await uploadCsv(formData);
      if (!res.ok) return void toast.error(res.error);
      setResult(res.data);
      toast.success(`${res.data.stored} anúncios importados.`);
      router.refresh();
    });
  return (
    <div className="space-y-4">
      <form action={submit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input name="file" type="file" accept=".csv,text/csv" required className="sm:max-w-sm" aria-label="Planilha CSV" />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />}
            {pending ? "Importando…" : "Importar planilha"}
          </Button>
          <Button asChild variant="outline">
            <a href="/api/export?tipo=modelo">
              <Download />
              Baixar modelo
            </a>
          </Button>
        </div>
      </form>
      {result && (
        <div className="rounded-lg border bg-accent/40 p-3 text-sm" role="status">
          <p className="font-medium">
            {result.stored} anúncios lidos: {result.created} novos, {result.updated} atualizados, {result.unchanged} sem mudança. {result.located} localizados e {result.analyzed} analisados agora; o restante entra na próxima coleta.
          </p>
          {result.errorCount > 0 && (
            <>
              <p className="mt-2 text-amber-800">{result.errorCount} linha(s) rejeitada(s):</p>
              <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                {result.errors.map((e) => (
                  <li key={e.line}>
                    Linha {e.line}: {e.error}
                  </li>
                ))}
                {result.errorCount > result.errors.length && <li>… e mais {result.errorCount - result.errors.length}.</li>}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
