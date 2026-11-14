import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { afterAll, beforeAll, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Set TEST_DATABASE_URL to a disposable PostGIS database (its schema is reset).");
if (/neon\.tech|vercel/i.test(url)) throw new Error("TEST_DATABASE_URL looks like a hosted database; use a local one.");
process.env.DATABASE_URL = url;
process.env.LOG_LEVEL = "silent";

// Terrain tiles are network data; tests use a fixed slope.
vi.mock("@/server/geo/terrain", () => ({ slopeAt: async () => 12 }));

beforeAll(async () => {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  await pool.query("drop schema if exists drizzle cascade; drop schema public cascade; create schema public;");
  await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
  await pool.end();
});

afterAll(async () => {
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});
