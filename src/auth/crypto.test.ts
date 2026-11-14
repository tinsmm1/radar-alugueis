import { describe, expect, it } from "vitest";
import { hashPassword, safeEqual, safeNext, sessionKey, signSession, verifyPassword, verifySession } from "./crypto";

describe("auth crypto", () => {
  it("hashes and verifies passwords", async () => {
    const h = await hashPassword("senha-forte-1");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("senha-forte-1", h)).toBe(true);
    expect(await verifyPassword("errada", h)).toBe(false);
    expect(await verifyPassword("x", "md5$a$b")).toBe(false);
  });
  it("signs sessions bound to the password and expiring", () => {
    const key = sessionKey({ password: "h1", databaseUrl: "postgres://x" });
    const token = signSession(key, 1_000);
    expect(verifySession(token, key, 2_000)).toBe(true);
    expect(verifySession(token, sessionKey({ password: "h2", databaseUrl: "postgres://x" }), 2_000)).toBe(false);
    expect(verifySession(token, key, 1_000 + 31 * 86_400_000)).toBe(false);
    expect(verifySession(`${token}x`, key, 2_000)).toBe(false);
    expect(verifySession("a.b", key)).toBe(false);
  });
  it("only accepts local redirects", () => {
    expect(safeNext("/imovel/1")).toBe("/imovel/1");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/login")).toBe("/");
  });
  it("constant-time compare", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
});
