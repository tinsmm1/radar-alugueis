import "server-only";
import { databaseUrlSchema, logLevelSchema, optionalEnvSchema, parseEnv, type OptionalEnvKey } from "./env-schema";

/** Neon on Vercel exposes POSTGRES_URL too; DATABASE_URL wins. */
export function getDatabaseUrl() {
  return parseEnv("DATABASE_URL", process.env.DATABASE_URL || process.env.POSTGRES_URL, databaseUrlSchema);
}

export function getLogLevel() {
  return parseEnv("LOG_LEVEL", process.env.LOG_LEVEL, logLevelSchema);
}

/** Optional variable: the value when valid, undefined when absent or invalid. */
export function optionalEnv(key: OptionalEnvKey): string | undefined {
  const raw = process.env[key];
  if (raw == null || raw === "") return undefined;
  const res = optionalEnvSchema[key].safeParse(raw);
  return res.success ? String(res.data) : undefined;
}

/** "absent" (not set), "valid", or "invalid" (set to a value that fails validation). */
export function envState(key: OptionalEnvKey): "absent" | "valid" | "invalid" {
  const raw = process.env[key];
  if (raw == null || raw === "") return "absent";
  return optionalEnvSchema[key].safeParse(raw).success ? "valid" : "invalid";
}

/** Names of optional variables that are set but invalid (shown in Administração, never their values). */
export function invalidEnv(): OptionalEnvKey[] {
  return (Object.keys(optionalEnvSchema) as OptionalEnvKey[]).filter((k) => {
    const raw = process.env[k];
    return raw != null && raw !== "" && !optionalEnvSchema[k].safeParse(raw).success;
  });
}

/** Public base URL for links in notifications. */
export function appUrl(): string {
  const fixed = optionalEnv("APP_URL");
  if (fixed) return fixed.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3700";
}
