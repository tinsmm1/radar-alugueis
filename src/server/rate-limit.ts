import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";

/** Hashed client key (IP + scope); the IP itself is never stored (LGPD). */
export async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  return `${scope}:${createHash("sha256").update(ip).digest("hex").slice(0, 24)}`;
}

/** Fixed-window counter in Postgres (works across serverless instances). True = allowed. */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const expired = sql`${rateLimits.windowStart} < now() - make_interval(secs => ${windowSeconds})`;
  const [row] = await getDb()
    .insert(rateLimits)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return (row?.count ?? 1) <= limit;
}

export async function resetHits(key: string): Promise<void> {
  const db = getDb();
  await db.delete(rateLimits).where(sql`${rateLimits.key} = ${key}`);
}
