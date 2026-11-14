import { NextResponse } from "next/server";
import { safeEqual } from "@/auth/crypto";
import { envState, optionalEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { runStep, type Trigger } from "@/server/collect/run";
import { BUSY, withRunLock } from "@/server/run-lock";
import { hit } from "@/server/rate-limit";
import { ensureSeeded } from "@/server/settings";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** HTTP calls are never "manual" (that is the admin button): they respect the 2 h gap between runs. */
function triggerOf(request: Request): Trigger {
  return /vercel-cron/i.test(request.headers.get("user-agent") ?? "") ? "vercel" : "github";
}

/**
 * Scheduler entry (GitHub Actions at 06:00/18:00 BRT, Vercel Cron as backup). With CRON_SECRET,
 * "Authorization: Bearer <CRON_SECRET>" is required. Without it the endpoint stays open but can
 * only advance or start a run (a new run at most every 2 h), never read data.
 */
async function handle(request: Request) {
  // A CRON_SECRET set to an invalid (too short) value fails closed instead of opening the endpoint.
  if (envState("CRON_SECRET") === "invalid") return NextResponse.json({ app: "radar-alugueis", error: "CRON_SECRET inválido (mínimo de 16 caracteres)" }, { status: 503 });
  const secret = optionalEnv("CRON_SECRET");
  if (secret) {
    const m = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
    if (!m || !safeEqual(m[1].trim(), secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  } else if (!(await hit("cron:open", 40, 3600))) {
    // Without a secret the endpoint stays usable by the scheduler but is capped (a run needs ~10 calls).
    return NextResponse.json({ app: "radar-alugueis", error: "too many calls" }, { status: 429 });
  }
  try {
    await ensureSeeded();
    const result = await withRunLock("collect", () => runStep(triggerOf(request), 50_000));
    if (result === BUSY) return NextResponse.json({ app: "radar-alugueis", busy: true, more: true });
    if (!result) return NextResponse.json({ app: "radar-alugueis", idle: true, more: false });
    return NextResponse.json({ app: "radar-alugueis", ...result });
  } catch (err) {
    logger.error({ msg: (err as Error).message }, "collect step failed");
    return NextResponse.json({ app: "radar-alugueis", error: "falha na execução" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
