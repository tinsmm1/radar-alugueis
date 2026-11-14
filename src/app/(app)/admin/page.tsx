import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Mail, MessageCircle } from "lucide-react";
import { Pill, Section, Stat, StatusPill } from "@/components/admin/ui";
import { RunNow } from "@/components/admin/run-now";
import { formatDateTime, formatDuration, overview } from "@/server/queries/admin";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Visão geral" };
export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const o = await overview();
  const stats = (o.last?.stats ?? {}) as Record<string, unknown>;
  const pct = o.location.total ? Math.round((o.location.located / o.location.total) * 100) : 0;
  return (
    <>
      {o.invalid.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Variáveis de ambiente com valor inválido (ignoradas): <b>{o.invalid.join(", ")}</b>. Corrija em Vercel → Settings → Environment Variables e publique de novo.
          </p>
        </div>
      )}
      {o.counts.demo > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-demo/30 bg-demo/8 p-4 text-sm">
          <Pill tone="demo">Demonstração</Pill>
          <span>{o.counts.demo} anúncios fictícios de demonstração estão carregados.</span>
          <Link href="/admin/demonstracao" className="font-medium text-primary hover:underline">Gerenciar</Link>
        </div>
      )}
      <Section
        title="Coleta automática"
        description="Rodadas diárias às 06:00 e às 18:00 (horário de Brasília) pelo GitHub Actions, com a Vercel como reserva. Cada chamada avança a execução em etapas."
        actions={<RunNow />}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Última execução" value={o.last ? <span className="flex items-center gap-2">{formatDateTime(o.last.startedAt)}</span> : "Nunca"} hint={o.last ? <span className="inline-flex items-center gap-1.5"><StatusPill status={o.last.status} /> {o.last.trigger} · {formatDuration(o.last.durationMs)}</span> : "Use o botão para a primeira coleta."} />
          <Stat label="Última concluída" value={formatDateTime(o.lastOk?.finishedAt)} hint={o.lastOk?.error ?? "sem falhas registradas"} />
          <Stat label="Próximas rodadas" value={<span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4 text-primary" />{formatDateTime(o.next[0])}</span>} hint={`depois ${formatDateTime(o.next[1])}`} />
          <Stat label="Fontes com falha" value={o.counts.failing} hint={o.counts.failing ? <Link className="text-primary hover:underline" href="/admin/fontes">Ver fontes</Link> : "todas respondendo ou pendentes"} />
        </div>
        {o.last?.status === "running" && <p className="mt-3 text-sm text-muted-foreground">Execução em andamento na etapa <b>{o.last.stage}</b>.</p>}
        {Object.keys(stats).length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Última execução: {Number(stats.geocodificados ?? 0)} endereços localizados · {Number(stats.analisados ?? 0)} análises · {Number(stats.oportunidades ?? 0)} oportunidades · {Number(stats.emails ?? 0)} e-mails · {Number(stats.telegram ?? 0)} Telegram
          </p>
        )}
        {!o.env.cronSecret && (
          <p className="mt-3 text-xs text-amber-800">
            Recomendado: defina <code>CRON_SECRET</code> na Vercel e nos secrets do GitHub para que só o seu agendador acione a coleta.
          </p>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Base de imóveis">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Imóveis" value={o.counts.properties.toLocaleString("pt-BR")} hint={`${o.counts.active.toLocaleString("pt-BR")} disponíveis`} />
            <Stat label="Anúncios" value={o.counts.listings.toLocaleString("pt-BR")} hint="somando todas as fontes" />
            <Stat label="Localizados no mapa" value={`${pct}%`} hint={`${o.location.located} de ${o.location.total}`} />
            <Stat label="Localização aproximada" value={o.location.approximate} hint="centro do bairro ou endereço oculto" />
          </div>
        </Section>
        <Section title="Canais de notificação" actions={<Link href="/admin/notificacoes" className="text-sm font-medium text-primary hover:underline">Configurar</Link>}>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Mail className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="font-medium">E-mail {o.channels.email ? <Pill tone="ok"><CheckCircle2 className="size-3" />Ativo</Pill> : <Pill>Inativo</Pill>}</p>
                <p className="text-muted-foreground">{o.channels.email ? `Envio para ${o.channels.email}` : o.env.email ? "Informe o e-mail de destino." : "Defina RESEND_API_KEY ou SMTP_URL na Vercel e um e-mail de destino."}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <MessageCircle className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Telegram {o.channels.telegram ? <Pill tone="ok"><CheckCircle2 className="size-3" />Ativo</Pill> : <Pill>Inativo</Pill>}</p>
                <p className="text-muted-foreground">{o.channels.telegram ? "Mensagens para o chat configurado." : o.env.telegram ? "Informe o chat_id." : "Defina TELEGRAM_BOT_TOKEN na Vercel e o chat_id."}</p>
              </div>
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Sem canais, as notificações ficam no sino, no topo da tela.</p>
        </Section>
      </div>
    </>
  );
}
