"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { channels, sendEmail, sendTelegram } from "../notify/deliver";
import { ActionError, parse, runAction } from "./run-action";

const schema = z.object({
  notifyEmail: z.union([z.email("E-mail inválido."), z.literal("")]),
  telegramChatId: z.union([z.string().regex(/^-?\d{3,20}$/, "O chat_id do Telegram é um número (ex.: 123456789 ou -100123...)."), z.literal("")]),
});

export async function saveChannels(input: z.input<typeof schema>) {
  return runAction("saveChannels", async () => {
    const v = parse(schema, input);
    const db = getDb();
    await db.update(settings).set({ notifyEmail: v.notifyEmail || null, telegramChatId: v.telegramChatId || null, updatedAt: new Date() }).where(eq(settings.id, 1));
  }, "/admin");
}

/** Sends a test message on one channel; delivery errors are shown (they never contain secrets). */
export async function testChannel(kind: "email" | "telegram") {
  return runAction("testChannel", async () => {
    const k = parse(z.enum(["email", "telegram"]), kind);
    const ch = await channels();
    try {
      if (k === "email") {
        if (!ch.email) throw new ActionError("Configure o destino e RESEND_API_KEY ou SMTP_URL na Vercel.");
        await sendEmail(ch.email, "Teste do Radar Aluguéis BH", "<p>Os alertas do <b>Radar Aluguéis BH</b> chegarão neste e-mail.</p>", "Os alertas do Radar Aluguéis BH chegarão neste e-mail.");
      } else {
        if (!ch.telegram) throw new ActionError("Configure o chat_id e TELEGRAM_BOT_TOKEN na Vercel.");
        await sendTelegram(ch.telegram, "<b>Radar Aluguéis BH</b>\nOs alertas chegarão nesta conversa.");
      }
    } catch (err) {
      if (err instanceof ActionError) throw err;
      throw new ActionError(`Falha no envio: ${(err as Error).message.slice(0, 200)}`);
    }
  });
}

export async function markNotificationsSeen() {
  return runAction("markNotificationsSeen", async () => {
    const db = getDb();
    await db.update(settings).set({ notificationsSeenAt: new Date() }).where(eq(settings.id, 1));
  }, "/");
}
