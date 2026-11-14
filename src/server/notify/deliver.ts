import "server-only";
import nodemailer from "nodemailer";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { notifications, properties } from "@/db/schema";
import { brl, pctBp } from "@/domain/money";
import { appUrl, optionalEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeFetch } from "../http";
import { getSettings } from "../settings";
import { KIND_LABEL, type NotificationKind } from "./events";

type Line = { kind: NotificationKind; title: string; detail: string; url: string | null };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Channels configured: e-mail (Resend or SMTP + destination) and Telegram (bot + chat). */
export async function channels(): Promise<{ email: string | null; telegram: string | null }> {
  const s = await getSettings();
  const email = s.notifyEmail ?? optionalEnv("NOTIFY_EMAIL") ?? null;
  const telegram = s.telegramChatId ?? optionalEnv("TELEGRAM_CHAT_ID") ?? null;
  return { email: email && (optionalEnv("RESEND_API_KEY") || optionalEnv("SMTP_URL")) ? email : null, telegram: telegram && optionalEnv("TELEGRAM_BOT_TOKEN") ? telegram : null };
}

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  const from = optionalEnv("EMAIL_FROM") ?? "Radar Aluguéis BH <onboarding@resend.dev>";
  const resend = optionalEnv("RESEND_API_KEY");
  if (resend) {
    const res = await safeFetch("https://api.resend.com/emails", { method: "POST", accept: "application/json", headers: { authorization: `Bearer ${resend}`, "content-type": "application/json" }, body: JSON.stringify({ from, to, subject, html, text }), timeoutMs: 15_000 });
    if (res.status >= 300) throw new Error(`Resend respondeu HTTP ${res.status}.`);
    return;
  }
  const smtp = optionalEnv("SMTP_URL");
  if (!smtp) throw new Error("Nenhum envio de e-mail configurado.");
  await nodemailer.createTransport(smtp).sendMail({ from, to, subject, html, text });
}

export async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = optionalEnv("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não configurado.");
  const res = await safeFetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", accept: "application/json", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }), timeoutMs: 15_000 });
  if (res.status >= 300) throw new Error(`Telegram respondeu HTTP ${res.status}.`);
}

async function pending(column: AnyPgColumn): Promise<Array<{ id: number } & Line>> {
  const db = getDb();
  const rows = await db
    .select({ id: notifications.id, kind: notifications.kind, payload: notifications.payload, pid: notifications.propertyId, title: properties.title, neighborhood: properties.neighborhood, total: properties.totalCents, rent: properties.rentCents, sale: properties.salePriceCents })
    .from(notifications)
    .leftJoin(properties, eq(properties.id, notifications.propertyId))
    .where(and(isNull(column), sql`${notifications.createdAt} > now() - interval '3 days'`))
    .orderBy(notifications.createdAt)
    .limit(50);
  const base = appUrl();
  return rows.map((r) => {
    const pl = (r.payload ?? {}) as { search?: string; mode?: string; dropBp?: number | null; targetCents?: number; priceCents?: number; source?: string; error?: string };
    const kind = r.kind as NotificationKind;
    if (kind === "fonte_falhou") return { id: r.id, kind, title: `Fonte com falha: ${pl.source}`, detail: pl.error ?? "", url: `${base}/admin` };
    const where = [r.title ?? "Imóvel", r.neighborhood].filter(Boolean).join(" · ");
    const buy = pl.mode === "compra";
    const price = buy ? (r.sale ? `${brl(r.sale)} à venda` : null) : (r.total ?? r.rent) ? `${brl(r.total ?? r.rent)}/mês` : null;
    const origin = pl.search ? `Busca "${pl.search}"` : kind === "preco_alvo" ? `Alvo de ${brl(pl.targetCents ?? null)}${buy ? "" : "/mês"}` : "Imóvel acompanhado";
    const detail = [buy ? "Comprar" : "Alugar", origin, price, pl.dropBp ? `−${pctBp(pl.dropBp)}` : null].filter(Boolean).join(" · ");
    return { id: r.id, kind, title: `${KIND_LABEL[kind]}: ${where}`, detail, url: `${base}/imovel/${r.pid}${buy ? "?modo=compra" : "?modo=aluguel"}` };
  });
}

const TELEGRAM_LIMIT = 3900;

/** Splits the digest into messages under Telegram's limit without cutting an item. */
export function telegramChunks(items: Array<{ id: number } & Line>): Array<{ text: string; ids: number[] }> {
  const chunks: Array<{ text: string; ids: number[] }> = [];
  let cur = { text: "", ids: [] as number[] };
  for (const i of items) {
    const block = `<b>${esc(i.title.slice(0, 300))}</b>\n${esc(i.detail.slice(0, 600))}${i.url ? `\n${esc(i.url)}` : ""}`;
    const next = cur.text ? `${cur.text}\n\n${block}` : block;
    if (next.length > TELEGRAM_LIMIT && cur.ids.length) {
      chunks.push(cur);
      cur = { text: block, ids: [i.id] };
    } else cur = { text: next, ids: [...cur.ids, i.id] };
  }
  if (cur.ids.length) chunks.push(cur);
  return chunks;
}

/** Sends pending notifications as one digest per channel; failures stay pending for the next run. */
export async function deliverPending(): Promise<{ email: number; telegram: number }> {
  const db = getDb();
  const ch = await channels();
  const out = { email: 0, telegram: 0 };
  if (ch.email) {
    const items = await pending(notifications.emailedAt);
    if (items.length) {
      try {
        const html = `<div style="font-family:system-ui,sans-serif;max-width:560px"><h2 style="color:#1d4ed8">Radar Aluguéis BH</h2>${items.map((i) => `<p style="margin:0 0 14px"><b>${esc(i.title)}</b><br><span style="color:#555">${esc(i.detail)}</span>${i.url ? `<br><a href="${esc(i.url)}">Ver no Radar</a>` : ""}</p>`).join("")}</div>`;
        const text = items.map((i) => `${i.title}\n${i.detail}\n${i.url ?? ""}`).join("\n\n");
        await sendEmail(ch.email, items.length === 1 ? items[0].title : `${items.length} novidades no Radar Aluguéis BH`, html, text);
        await db.update(notifications).set({ emailedAt: new Date() }).where(inArray(notifications.id, items.map((i) => i.id)));
        out.email = items.length;
      } catch (err) {
        logger.warn({ msg: (err as Error).message }, "email delivery failed");
      }
    }
  }
  if (ch.telegram) {
    const items = await pending(notifications.telegramAt);
    if (items.length) {
      try {
        // Whole items only (cutting the HTML would make Telegram refuse the message); the rest
        // go in the next messages.
        for (const chunk of telegramChunks(items)) {
          await sendTelegram(ch.telegram, chunk.text);
          await db.update(notifications).set({ telegramAt: new Date() }).where(inArray(notifications.id, chunk.ids));
          out.telegram += chunk.ids.length;
        }
      } catch (err) {
        logger.warn({ msg: (err as Error).message }, "telegram delivery failed");
      }
    }
  }
  return out;
}
