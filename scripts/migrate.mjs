#!/usr/bin/env node
// Applies the SQL migrations in drizzle/ (tracked, idempotent). Runs on every Vercel build
// (vercel-build). Without a database URL it explains and skips, so the first deploy builds.
import nextEnv from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!url) {
  console.warn("[migrate] Nenhum banco conectado (DATABASE_URL ausente): migrações puladas. Conecte o Postgres (Neon) na Vercel e publique de novo.");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 15_000 });
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
  console.log("[migrate] Banco atualizado.");
} catch (err) {
  console.error("[migrate] Falhou:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
