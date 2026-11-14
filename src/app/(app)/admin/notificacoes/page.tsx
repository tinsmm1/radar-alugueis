import { CheckCircle2, CircleDashed } from "lucide-react";
import { ChannelsForm } from "@/components/admin/channels-form";
import { Section } from "@/components/admin/ui";
import { overview } from "@/server/queries/admin";
import { getSettings } from "@/server/settings";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

function Req({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <span>{children}</span>
    </li>
  );
}

export default async function ChannelsPage() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const [o, s] = await Promise.all([overview(), getSettings()]);
  return (
    <>
      <Section
        title="Canais de notificação"
        description="Você recebe um resumo por rodada: novos imóveis das buscas salvas, reduções de preço e mudanças nos favoritos (indisponível ou de volta), além de falhas de fontes."
      >
        <ChannelsForm email={s.notifyEmail ?? ""} telegram={s.telegramChatId ?? ""} canEmail={Boolean(o.channels.email)} canTelegram={Boolean(o.channels.telegram)} />
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="E-mail: o que configurar na Vercel">
          <ul className="space-y-2 text-sm">
            <Req ok={o.env.email}>
              <b>RESEND_API_KEY</b> (Resend, grátis até 3.000 e-mails/mês) <i>ou</i> <b>SMTP_URL</b> (ex.: Gmail com senha de app: <code className="text-xs break-all">smtps://usuario%40gmail.com:senha@smtp.gmail.com:465</code>).
            </Req>
            <Req ok={false}>
              <b>EMAIL_FROM</b> (opcional): remetente, ex.: <code className="text-xs break-all">Radar Aluguéis BH &lt;alertas@seudominio.com&gt;</code>. Sem domínio próprio, o Resend só entrega para o e-mail da sua conta.
            </Req>
            <Req ok={Boolean(o.env.notifyEmail)}>Destino: o campo acima (ou a variável NOTIFY_EMAIL).</Req>
          </ul>
        </Section>
        <Section title="Telegram: como ativar">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>No Telegram, fale com <b>@BotFather</b>, envie <code>/newbot</code> e copie o token.</li>
            <li>
              Na Vercel, crie <b>TELEGRAM_BOT_TOKEN</b> com o token {o.env.telegram ? <span className="text-emerald-700">(configurado)</span> : <span className="text-muted-foreground">(ainda não configurado)</span>} e publique de novo.
            </li>
            <li>Mande qualquer mensagem para o seu bot. Descubra o seu chat_id falando com <b>@userinfobot</b> e informe-o acima.</li>
          </ol>
        </Section>
      </div>
    </>
  );
}
