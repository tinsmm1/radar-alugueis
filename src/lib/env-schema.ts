import { z } from "zod";

export const databaseUrlSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
});

export const logLevelSchema = z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info");

/** Every variable is optional; an invalid value is ignored and named in Administração. */
export const optionalEnvSchema = {
  /** Fixed owner password (recovery); without it the owner creates one on the first visit. */
  APP_PASSWORD: z.string().min(8),
  /** Cookie signing key (32+ chars); derived from the password hash and database URL when absent. */
  AUTH_SECRET: z.string().min(32),
  /** Bearer secret for the scheduler (GitHub Actions and Vercel Cron). */
  CRON_SECRET: z.string().min(16),
  RESEND_API_KEY: z.string().min(8),
  SMTP_URL: z.string().regex(/^smtps?:\/\/\S+$/),
  EMAIL_FROM: z.string().min(3),
  NOTIFY_EMAIL: z.email(),
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]{20,}$/),
  TELEGRAM_CHAT_ID: z.string().regex(/^-?\d+$/),
  /** Public address used in notification links. */
  APP_URL: z.url(),
  /** Contact e-mail sent to Nominatim in the User-Agent (their usage policy asks for one). */
  GEOCODER_CONTACT: z.email(),
  /** Apify API token: reads the datasets of the owner's portal scraper tasks (opt-in, see docs/fontes.md). */
  APIFY_TOKEN: z.string().regex(/^apify_api_[\w-]{20,}$/),
} as const;
export type OptionalEnvKey = keyof typeof optionalEnvSchema;

export function parseEnv<T>(key: string, value: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(value);
  // Zod issues can include input values; expose only the variable name.
  if (!result.success) throw new Error(`Invalid or missing environment variable: ${key}`);
  return result.data;
}
