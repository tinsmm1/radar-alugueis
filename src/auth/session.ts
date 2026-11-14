import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { envState, optionalEnv } from "@/lib/env";
import { getSettings } from "@/server/settings";
import { SESSION_COOKIE, SESSION_DAYS, sessionKey, signSession, verifySession } from "./crypto";

export type AuthMode = { mode: "env"; secret: string } | { mode: "db"; secret: string } | { mode: "setup" } | { mode: "misconfigured" };

/** APP_PASSWORD (fixed) or the hash created on the first visit. */
export const getAuthMode = cache(async (): Promise<AuthMode> => {
  // A security variable set to an invalid value fails closed (never falls back to open setup).
  if (envState("APP_PASSWORD") === "invalid" || envState("AUTH_SECRET") === "invalid") return { mode: "misconfigured" };
  const fixed = optionalEnv("APP_PASSWORD");
  if (fixed) return { mode: "env", secret: fixed };
  const s = await getSettings();
  return s.passwordHash ? { mode: "db", secret: s.passwordHash } : { mode: "setup" };
});

export function keyFor(secret: string): Buffer {
  return sessionKey({ password: secret, authSecret: optionalEnv("AUTH_SECRET"), databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL });
}

export async function currentKey(): Promise<Buffer | null> {
  const auth = await getAuthMode();
  return auth.mode === "env" || auth.mode === "db" ? keyFor(auth.secret) : null;
}

/** Valid signed session cookie (deduped per request). */
export const isAuthenticated = cache(async (): Promise<boolean> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const key = await currentKey().catch(() => null);
  return Boolean(key && verifySession(token, key));
});

export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login");
}

export async function startSession(key: Buffer): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, signSession(key), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
