import { Download, ShieldCheck } from "lucide-react";
import { Section } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { RETENTION } from "@/server/collect/retention";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Backup e dados" };

export default async function DataPage() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  return (
    <>
      <Section title="Backup" description="Os dados ficam no Postgres (Neon). Baixe cópias quando quiser; elas não contêm senha nem chaves.">
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href="/api/export?tipo=json">
              <Download />
              Favoritos, listas, buscas e fontes (JSON)
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/export?tipo=imoveis">
              <Download />
              Imóveis disponíveis (CSV)
            </a>
          </Button>
        </div>
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p>
            <b className="text-foreground">Restauração completa:</b> o Neon guarda o histórico do banco e permite restaurar um momento anterior (point-in-time restore) em Console → Branches → Restore. No plano gratuito a janela é curta (horas); para guardar por mais tempo, baixe o JSON acima periodicamente ou use <code>pg_dump</code> com a URL direta do banco.
          </p>
          <p>Anúncios e camadas não precisam de backup: são coletados de novo das fontes.</p>
        </div>
      </Section>
      <Section title="Política de retenção" description="Aplicada automaticamente ao fim de cada rodada de coleta.">
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          <li className="rounded-lg border p-3">
            <b>Dados originais dos anúncios</b>
            <p className="text-muted-foreground">A versão mais recente de cada anúncio é mantida; versões antigas por {RETENTION.rawDays} dias.</p>
          </li>
          <li className="rounded-lg border p-3">
            <b>Registros de execuções</b>
            <p className="text-muted-foreground">{RETENTION.runDays} dias.</p>
          </li>
          <li className="rounded-lg border p-3">
            <b>Notificações</b>
            <p className="text-muted-foreground">{RETENTION.notificationDays} dias.</p>
          </li>
          <li className="rounded-lg border p-3">
            <b>Anúncios indisponíveis</b>
            <p className="text-muted-foreground">Removidos {RETENTION.unavailableDays} dias depois da última vez em que apareceram, exceto se estiverem nos favoritos.</p>
          </li>
        </ul>
      </Section>
      <Section title="Privacidade (LGPD)">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />Dos anunciantes, só o nome da imobiliária é guardado. Telefones, e-mails e nomes de corretores são descartados já na leitura do feed.</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />Endereços IP de acesso não são armazenados: o limite de tentativas usa só um resumo criptográfico (hash).</li>
          <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />O Radar é de uso pessoal e protegido por senha; os anúncios de feeds autorizados não são republicados.</li>
        </ul>
      </Section>
    </>
  );
}
