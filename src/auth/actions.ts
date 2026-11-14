"use server";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { logger } from "@/lib/logger";
import { clientKey, hit, resetHits } from "@/server/rate-limit";
import { hashPassword, MIN_PASSWORD, safeEqual, safeNext, verifyPassword } from "./crypto";
import { endSession, getAuthMode, isAuthenticated, keyFor, startSession } from "./session";

export type FormState = { error: string } | { ok: string } | null;

const MAX_ATTEMPTS = 8;
const MISCONFIGURED = "APP_PASSWORD ou AUTH_SECRET está com valor inválido na Vercel (mínimo de 8 e 32 caracteres). Corrija e publique de novo.";
const WINDOW_SECONDS = 15 * 60;

function validNew(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use pelo menos ${MIN_PASSWORD} caracteres.`;
  if (password.length > 200) return "Senha longa demais.";
  if (password !== confirm) return "As duas senhas não são iguais.";
  return null;
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  try {
    const key = await clientKey("login");
    if (!(await hit(key, MAX_ATTEMPTS, WINDOW_SECONDS))) return { error: "Muitas tentativas. Aguarde 15 minutos." };
    const auth = await getAuthMode();
    if (auth.mode === "misconfigured") return { error: MISCONFIGURED };
    if (auth.mode === "setup") return { error: "Crie a sua senha primeiro." };
    const ok = auth.mode === "env" ? safeEqual(password, auth.secret) : await verifyPassword(password, auth.secret);
    if (!ok) return { error: "Senha incorreta." };
    await resetHits(key);
    await startSession(keyFor(auth.secret));
  } catch (err) {
    logger.error({ scope: "login", msg: (err as Error)?.message }, "login failed");
    return { error: "Não foi possível entrar agora. Verifique se o banco de dados está conectado." };
  }
  redirect(next);
}

/** First visit: creates the password, only while none exists (first request wins). */
export async function createPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const problem = validNew(password, String(formData.get("confirm") ?? ""));
  if (problem) return { error: problem };
  try {
    if ((await getAuthMode()).mode !== "setup") return { error: "A senha já foi criada. Entre com ela." };
    const hash = await hashPassword(password);
    const db = getDb();
    const rows = await db.update(settings).set({ passwordHash: hash, updatedAt: new Date() }).where(and(eq(settings.id, 1), isNull(settings.passwordHash))).returning({ id: settings.id });
    if (!rows.length) return { error: "A senha já foi criada. Entre com ela." };
    await startSession(keyFor(hash));
  } catch (err) {
    logger.error({ scope: "createPassword", msg: (err as Error)?.message }, "setup failed");
    return { error: "Não foi possível salvar. Verifique se o banco de dados está conectado." };
  }
  redirect("/?bem-vindo=1");
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await isAuthenticated())) return { error: "Sessão expirada. Entre novamente." };
  const auth = await getAuthMode();
  if (auth.mode !== "db") return { error: "A senha está definida na variável APP_PASSWORD; altere por lá." };
  const password = String(formData.get("password") ?? "");
  const problem = validNew(password, String(formData.get("confirm") ?? ""));
  if (problem) return { error: problem };
  if (!(await verifyPassword(String(formData.get("current") ?? ""), auth.secret))) return { error: "Senha atual incorreta." };
  const hash = await hashPassword(password);
  const db = getDb();
  await db.update(settings).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(settings.id, 1));
  await startSession(keyFor(hash));
  return { ok: "Senha alterada. Os outros aparelhos precisarão entrar de novo." };
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}
