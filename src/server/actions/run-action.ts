import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { isAuthenticated } from "@/auth/session";
import { logger } from "@/lib/logger";
import { ensureSeeded } from "../settings";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/** Expected, user-facing failure: its message is shown as is. Every other error is generic. */
export class ActionError extends Error {}

export const SESSION_EXPIRED = "Sessão expirada. Entre novamente.";

/** Wraps every server action: session check, seeded database, Portuguese errors, revalidation. */
export async function runAction<T>(scope: string, body: () => Promise<T>, revalidate = "/"): Promise<ActionResult<T>> {
  if (!(await isAuthenticated())) return { ok: false, error: SESSION_EXPIRED };
  try {
    await ensureSeeded();
    const data = await body();
    revalidatePath(revalidate, "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, error: err.message };
    const e = err as { code?: string; message?: string };
    logger.error({ scope, code: e?.code, msg: e?.message }, "action failed");
    return { ok: false, error: "Não foi possível concluir. Tente novamente." };
  }
}

/** Zod validation with the first issue as a user-facing message. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const res = schema.safeParse(input);
  if (!res.success) throw new ActionError(res.error.issues[0]?.message || "Dados inválidos.");
  return res.data;
}
