import "server-only";
import { after } from "next/server";
import { optionalEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeFetch } from "../http";

/** Upper bound of chained calls for one run (each advances it ~45 s). */
export const MAX_HOPS = 80;

/**
 * A run needs many ~45 s calls (geocoding is 1 request/s). Instead of depending on an external
 * scheduler, each call that leaves work behind asks the app itself for the next call once the
 * response is sent. The request is only fired: the next call runs on its own invocation.
 */
export function continueRunLater(hop: number): void {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const secret = optionalEnv("CRON_SECRET");
  if (!host || !secret || hop >= MAX_HOPS) return;
  after(async () => {
    try {
      await safeFetch(`https://${host}/api/cron/collect?hop=${hop}`, {
        method: "POST",
        timeoutMs: 6_000,
        headers: { authorization: `Bearer ${secret}` },
        allowRedirectTo: () => false,
      });
    } catch {
      // The timeout is expected: the next call keeps running on its own invocation.
    }
    logger.info({ hop }, "collect continuation requested");
  });
}
