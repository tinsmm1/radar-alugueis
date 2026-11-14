import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import * as schema from "./schema";

const globals = globalThis as typeof globalThis & { __appPostgresPool?: Pool };
let cached: { client: Pool; db: NodePgDatabase<typeof schema> } | undefined;

export function getDb() {
  let client = globals.__appPostgresPool;
  if (!client) {
    client = new Pool({
      connectionString: getDatabaseUrl(),
      max: 5,
      connectionTimeoutMillis: 10_000,
      // Short idle time: serverless instances freeze between requests.
      idleTimeoutMillis: 5_000,
    });
    client.on("error", (error) => {
      logger.error({ code: (error as NodeJS.ErrnoException).code }, "Idle database connection failed");
    });
    // Vercel Fluid compute: release idle connections before the instance is suspended.
    if (process.env.VERCEL) attachDatabasePool(client);
    globals.__appPostgresPool = client;
  }
  // Keep the pool through HMR, but rebuild the ORM when its schema module reloads.
  if (!cached || cached.client !== client) cached = { client, db: drizzle({ client, schema }) };
  return cached.db;
}

/** The shared pool, for work that needs one connection held (advisory locks). */
export function getPool(): Pool {
  getDb();
  return globals.__appPostgresPool!;
}

// Use only for owned shutdown/tests, never after each request.
export async function closeDatabase() {
  const client = globals.__appPostgresPool;
  delete globals.__appPostgresPool;
  cached = undefined;
  await client?.end();
}
