import { describe, expect, it } from "vitest";
import { safeNext } from "@/auth/crypto";
import { httpUrl, normalizedListingSchema } from "./listing";
import { scrubContacts } from "./text";
import { parseVrsync, scrubRaw } from "./vrsync";

describe("security regressions (review 13/11/2026)", () => {
  it("F6: post-login redirect stays on this site", () => {
    for (const bad of ["/\t/evil.example", "/\n/evil.example", "/\\evil.example", "//evil.example", "https://evil.example", "/login?next=/x", "/%09/evil"]) {
      const out = safeNext(bad);
      expect(new URL(out, "https://radar.example").host, bad).toBe("radar.example");
    }
    expect(safeNext("/imovel/12?x=1#analise")).toBe("/imovel/12?x=1#analise");
  });

  it("H2: contact data is removed from free text and raw payloads", () => {
    expect(scrubContacts("Fale com joao.silva@exemplo.com.br ou (31) 99999-8888 / 31 3333-4444 / +55 31 988887777")).toBe(
      "Fale com [contato removido] ou [contato removido] / [contato removido] / [contato removido]",
    );
    expect(scrubContacts("Apartamento 92 m², CEP 30130-151, R$ 3.500,00, código 1787700796555")).toBe("Apartamento 92 m², CEP 30130-151, R$ 3.500,00, código 1787700796555");
    const raw = scrubRaw({ Details: { Description: "Ligue 31 99999-0000" }, ContactInfo: { Name: "Imob", Telephone: "31 99999-0000" } });
    expect(JSON.stringify(raw)).not.toContain("99999");
    expect(raw.ContactInfo).toEqual({ Name: "Imob" });
  });

  it("links are http(s) only (no javascript: or data:)", () => {
    expect(httpUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(httpUrl.safeParse("data:text/html,x").success).toBe(false);
    expect(httpUrl.safeParse("https://example.com/a").success).toBe(true);
    const base = { externalId: "x", url: "javascript:alert(1)" };
    expect(normalizedListingSchema.shape.url.safeParse(base.url).success).toBe(false);
  });

  it("feeds with DTD entity declarations are refused", () => {
    const xml = '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><ListingDataFeed><Listings></Listings></ListingDataFeed>';
    expect(parseVrsync(xml)).toEqual({ ok: false, error: expect.stringContaining("ENTITY") });
  });
});
