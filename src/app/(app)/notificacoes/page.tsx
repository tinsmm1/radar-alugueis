import Link from "next/link";
import { AlertTriangle, Bell, Mail, MessageCircle, PlusCircle, RotateCcw, Target, TrendingDown, XCircle } from "lucide-react";
import { MarkSeen } from "@/components/personal/mark-seen";
import { brl, pctBp } from "@/domain/money";
import { cn } from "@/lib/utils";
import { KIND_LABEL, type NotificationKind } from "@/server/notify/events";
import { notificationViews } from "@/server/queries/personal";
import { requireAuth } from "@/auth/session";

export const metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

const ICON: Record<NotificationKind, { icon: typeof Bell; className: string }> = {
  novo: { icon: PlusCircle, className: "bg-accent text-primary" },
  baixa_preco: { icon: TrendingDown, className: "bg-emerald-50 text-emerald-700" },
  preco_alvo: { icon: Target, className: "bg-amber-50 text-amber-700" },
  indisponivel: { icon: XCircle, className: "bg-zinc-100 text-zinc-600" },
  voltou: { icon: RotateCcw, className: "bg-sky-50 text-sky-700" },
  fonte_falhou: { icon: AlertTriangle, className: "bg-red-50 text-red-700" },
};

const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function NotificationsPage() {
  // Each page verifies the session itself (defence in depth: the layout check alone can be skipped by partial renders).
  await requireAuth();
  const items = await notificationViews(100);
  const unread = items.filter((i) => i.unread).length;
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6 lg:py-8">
      <MarkSeen unread={unread} />
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Notificações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Novidades das buscas salvas, quedas de preço e preços-alvo dos imóveis que você acompanha, e falhas de fontes. Para recebê-las por e-mail ou Telegram, configure em <Link href="/admin/notificacoes" className="text-primary hover:underline">Administração</Link>.
        </p>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <Bell className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhuma notificação ainda</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Salve uma busca, favorite imóveis ou defina um preço-alvo: as novidades aparecem aqui depois de cada coleta. Dados de demonstração não geram notificações, porque não são anúncios reais.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card shadow-xs">
          {items.map((n) => {
            const kind = n.kind as NotificationKind;
            const meta = ICON[kind] ?? ICON.novo;
            const Icon = meta.icon;
            const p = n.payload ?? {};
            const title = kind === "fonte_falhou" ? `Fonte com falha: ${p.source ?? ""}` : n.title?.replace(/^\[DEMONSTRAÇÃO\]\s*/, "") ?? "Imóvel";
            const detail =
              kind === "fonte_falhou"
                ? p.error
                : [
                    p.mode === "compra" ? "Comprar" : "Alugar",
                    n.neighborhood,
                    p.mode === "compra" ? n.salePriceCents != null && brl(n.salePriceCents) : (n.totalCents ?? n.rentCents) != null && `${brl(n.totalCents ?? n.rentCents)}/mês`,
                    p.dropBp ? `−${pctBp(p.dropBp)}` : null,
                    kind === "preco_alvo" && p.targetCents != null ? `seu alvo: ${brl(p.targetCents)}` : null,
                    p.search ? `busca “${p.search}”` : p.favorite ? "acompanhado" : null,
                  ].filter(Boolean).join(" · ");
            const href = kind === "fonte_falhou" ? "/admin/fontes" : n.propertyId ? `/imovel/${n.propertyId}?modo=${p.mode ?? "aluguel"}` : null;
            const body = (
              <div className="flex gap-3 px-4 py-3.5">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", meta.className)}><Icon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{KIND_LABEL[kind] ?? n.kind}</p>
                  <p className={cn("truncate text-sm", n.unread && "font-semibold")}>{title}</p>
                  {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
                  <span>{fmt(n.createdAt)}</span>
                  <span className="flex gap-1.5">
                    {n.emailedAt && <Mail className="size-3.5" aria-label="Enviada por e-mail" />}
                    {n.telegramAt && <MessageCircle className="size-3.5" aria-label="Enviada pelo Telegram" />}
                  </span>
                  {n.unread && <span className="size-2 rounded-full bg-primary" aria-label="Não lida" />}
                </div>
              </div>
            );
            return <li key={n.id}>{href ? <Link href={href} className="block hover:bg-accent/40">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
