import "server-only";
import { getPool } from "@/db";

const KEYS = { collect: 7_400_001 } as const;

/**
 * At most one collection step at a time (GitHub, Vercel Cron, the admin button): a session
 * advisory lock held on one pooled connection. Returns BUSY when another step is running
 * (distinct from a step that itself returns null, e.g. no run due).
 */
export const BUSY = Symbol("busy");

export async function withRunLock<T>(kind: keyof typeof KEYS, fn: () => Promise<T>): Promise<T | typeof BUSY> {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>("select pg_try_advisory_lock($1) as ok", [KEYS[kind]]);
    if (!rows[0]?.ok) return BUSY;
    try {
      return await fn();
    } finally {
      await client.query("select pg_advisory_unlock($1)", [KEYS[kind]]).catch(() => undefined);
    }
  } finally {
    client.release();
  }
}
