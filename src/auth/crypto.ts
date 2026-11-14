import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "radar_session";
export const SESSION_DAYS = 30;
export const MIN_PASSWORD = 8;

/** Constant-time string comparison (hashing first equalizes lengths). */
export function safeEqual(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key))));
}

/** "scrypt$<salt>$<hash>" (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${(await scryptAsync(password, salt)).toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64url"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Session key bound to the password: changing the password signs every device out. */
export function sessionKey(input: { password: string; authSecret?: string; databaseUrl?: string }): Buffer {
  return createHash("sha256").update(`radar|${input.authSecret ?? ""}|${input.password}|${input.authSecret ? "" : (input.databaseUrl ?? "")}`).digest();
}

/** "<expiresAt>.<nonce>.<hmac>" */
export function signSession(key: Buffer, now = Date.now()): string {
  const payload = `${now + SESSION_DAYS * 86_400_000}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
}

export function verifySession(token: string, key: Buffer, now = Date.now()): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [exp, nonce, mac] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < now) return false;
  return safeEqual(mac, createHmac("sha256", key).update(`${exp}.${nonce}`).digest("base64url"));
}

/** Only same-site relative paths are accepted after login. */
export function safeNext(value: unknown): string {
  const s = typeof value === "string" ? value : "";
  // Browsers ignore tabs/newlines and treat "\\" as "/", so any of them could turn "/x" into "//host".
  if (!s.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(s) || s.startsWith("//")) return "/";
  try {
    const url = new URL(s, "http://radar.local");
    if (url.host !== "radar.local" || url.pathname.startsWith("/login")) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
