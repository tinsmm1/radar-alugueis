import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { favoriteLists, favorites, properties, savedSearches, settings, sources } from "@/db/schema";

/**
 * Owner backup: personal data and configuration, never secrets (no password hash, no env
 * variables) and no advertiser contacts (none are stored).
 */
export async function exportJson(): Promise<Record<string, unknown>> {
  const db = getDb();
  const [s] = await db.select({ notifyEmail: settings.notifyEmail, telegramChatId: settings.telegramChatId }).from(settings).where(eq(settings.id, 1));
  return {
    app: "radar-alugueis",
    exportedAt: new Date().toISOString(),
    settings: s ?? null,
    favoriteLists: await db.select().from(favoriteLists).orderBy(asc(favoriteLists.id)),
    favorites: await db.select().from(favorites),
    savedSearches: await db.select().from(savedSearches).orderBy(asc(savedSearches.id)),
    sources: await db
      .select({ key: sources.key, adapter: sources.adapter, name: sources.name, url: sources.url, status: sources.status, authorization: sources.authorization, isDemo: sources.isDemo, createdAt: sources.createdAt })
      .from(sources)
      .orderBy(asc(sources.id)),
  };
}

const COLUMNS = [
  "id", "titulo", "tipo", "bairro", "regional", "rua", "numero", "latitude", "longitude", "precisao_local", "para_alugar", "a_venda", "aluguel", "preco_venda",
  "preco_venda_m2", "aluguel_estimado", "rendimento_bruto_pct", "condominio", "iptu_mensal",
  "custo_total_conhecido", "situacao_custo", "custo_m2", "area_m2", "quartos", "suites", "banheiros", "vagas", "caracteristicas", "fontes",
  "anuncios", "situacao", "demonstracao", "risco_nivel", "risco_indice", "primeira_vez", "ultima_verificacao",
] as const;

const cell = (v: unknown) => {
  if (v == null) return "";
  let s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join("|") : String(v);
  // Text from sources must not run as a spreadsheet formula (CSV injection).
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const reais = (c: number | null) => (c == null ? null : (c / 100).toFixed(2).replace(".", ","));

/** Active properties as CSV (";" separated, UTF-8 with BOM for spreadsheets). */
export async function exportPropertiesCsv(): Promise<string> {
  const rows = await getDb().select().from(properties).where(sql`${properties.listingCount} > 0 and ${properties.status} <> 'indisponivel'`).orderBy(asc(properties.id));
  const lines = rows.map((p) =>
    [
      p.id, p.title, p.type, p.neighborhood, p.regional, p.street, p.number, p.lat, p.lng, p.geoPrecision, p.forRent ? "sim" : "não", p.forSale ? "sim" : "não", reais(p.rentCents), reais(p.salePriceCents),
      reais(p.salePriceM2Cents), reais(p.estRentCents), p.grossYieldBp == null ? null : (p.grossYieldBp / 100).toFixed(2).replace(".", ","), reais(p.condoCents), reais(p.iptuMonthlyCents),
      reais(p.totalCents), p.costStatus, reais(p.costPerM2Cents), p.areaM2, p.bedrooms, p.suites, p.bathrooms, p.parking, p.features, p.sourceKeys,
      p.listingCount, p.status, p.isDemo ? "sim" : "não", p.riskLevel, p.riskScore, p.firstSeenAt, p.lastSeenAt,
    ]
      .map(cell)
      .join(";"),
  );
  return `﻿${COLUMNS.join(";")}\n${lines.join("\n")}\n`;
}
