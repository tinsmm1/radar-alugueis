import { execFileSync } from "node:child_process";
import pg from "pg";
import { E2E_DB } from "../playwright.config";

/** Fresh e2e database: recreate, migrate and seed fixtures (no geographic downloads). */
export default async function globalSetup() {
  const admin = new URL(E2E_DB);
  const name = admin.pathname.slice(1);
  if (!/_e2e$/.test(name)) throw new Error("The e2e database name must end with _e2e.");
  admin.pathname = "/postgres";
  const pool = new pg.Pool({ connectionString: admin.toString(), max: 1 });
  await pool.query(`drop database if exists ${name} with (force)`);
  await pool.query(`create database ${name}`);
  await pool.end();
  const env = { ...process.env, DATABASE_URL: E2E_DB, LOG_LEVEL: "silent" };
  execFileSync("node", ["scripts/migrate.mjs"], { env, stdio: "inherit" });
  execFileSync("node", ["--conditions=react-server", "--import", "tsx", "e2e/seed.mts"], { env, stdio: "inherit" });
}
