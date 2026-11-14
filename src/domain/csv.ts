import { detectFeatures, EMPTY_LISTING, FEATURES, inScope, normalizeType, normalizedListingSchema, withImpliedFeatures, type Feature, type NormalizedListing } from "./listing";
import { parseArea, parseCount, parseMoney } from "./money";
import { normalizeText, titleCase } from "./text";
import { safeUrl } from "./vrsync";

/** Columns of the spreadsheet template (header names are matched without accents/case). */
export const CSV_COLUMNS = [
  "id", "link", "titulo", "tipo", "aluguel", "condominio", "iptu", "iptu_periodo", "outras_taxas", "area_m2", "quartos", "suites",
  "banheiros", "vagas", "caracteristicas", "anunciante", "anunciante_nome", "fotos", "rua", "numero", "bairro", "cidade", "cep",
  "latitude", "longitude", "descricao", "finalidade", "preco_venda",
] as const;

export const CSV_TEMPLATE = `${CSV_COLUMNS.join(";")}\n`;

/** RFC 4180-ish parser: quotes, escaped quotes, CRLF, ";" or "," (chosen from the header). */
export function parseCsvRows(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const FEATURE_BY_LABEL = new Map<string, Feature>(FEATURES.map((f) => [normalizeText(f.replace(/_/g, " ")), f]));

function features(raw: string, title: string, description: string): Feature[] {
  const explicit = raw
    .split(/[|,;/]/)
    .map((x) => FEATURE_BY_LABEL.get(normalizeText(x)))
    .filter((f): f is Feature => Boolean(f));
  return [...new Set([...explicit, ...detectFeatures(raw, title, description)])];
}

export type CsvResult = { ok: true; listings: NormalizedListing[]; errors: Array<{ line: number; error: string }> } | { ok: false; error: string };

export function parseListingsCsv(input: string): CsvResult {
  const rows = parseCsvRows(input);
  if (rows.length < 2) return { ok: false, error: "A planilha está vazia ou só tem o cabeçalho." };
  const header = rows[0].map((h) => normalizeText(h).replace(/ /g, "_"));
  const col = (name: string) => header.indexOf(name);
  if ((col("aluguel") < 0 && col("preco_venda") < 0) || col("bairro") < 0) return { ok: false, error: "Cabeçalho inválido: use o modelo (precisa da coluna bairro e de aluguel ou preco_venda)." };
  const errors: Array<{ line: number; error: string }> = [];
  const out = new Map<string, NormalizedListing>();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (name: string) => (col(name) >= 0 ? (r[col(name)] ?? "").trim() : "");
    const title = get("titulo");
    const description = get("descricao");
    const advertiser = normalizeText(get("anunciante"));
    const period = normalizeText(get("iptu_periodo"));
    const lat = Number(get("latitude").replace(",", "."));
    const lng = Number(get("longitude").replace(",", "."));
    const hasCoords = get("latitude") !== "" && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0;
    const draft: NormalizedListing = {
      ...EMPTY_LISTING,
      externalId: (get("id") || `linha-${line}`).slice(0, 200),
      url: safeUrl(get("link") || null),
      title: title.slice(0, 300) || null,
      description: description.slice(0, 20_000) || null,
      type: normalizeType(get("tipo"), title),
      rentCents: parseMoney(get("aluguel")) || null,
      salePriceCents: parseMoney(get("preco_venda")) || null,
      condoCents: parseMoney(get("condominio")),
      iptuCents: parseMoney(get("iptu")),
      iptuPeriod: period.startsWith("anu") ? "anual" : period.startsWith("mens") ? "mensal" : null,
      otherFeesCents: parseMoney(get("outras_taxas")),
      areaM2: parseArea(get("area_m2")),
      bedrooms: parseCount(get("quartos")),
      suites: parseCount(get("suites")),
      bathrooms: parseCount(get("banheiros")),
      parking: parseCount(get("vagas")),
      features: features(get("caracteristicas"), title, description),
      advertiserType: advertiser.startsWith("prop") ? "proprietario" : advertiser.startsWith("imob") || advertiser.startsWith("corret") ? "imobiliaria" : null,
      advertiserName: get("anunciante_nome").slice(0, 200) || null,
      photos: get("fotos")
        .split(/[|\s]+/)
        .map((u) => safeUrl(u || null))
        .filter((u): u is string => Boolean(u))
        .slice(0, 40),
      street: get("rua").slice(0, 200) || null,
      number: get("numero").slice(0, 20) || null,
      neighborhood: get("bairro") ? titleCase(get("bairro")).slice(0, 120) : null,
      city: get("cidade") ? titleCase(get("cidade")) : "Belo Horizonte",
      postalCode: get("cep").replace(/\D/g, "").slice(0, 8) || null,
      lat: hasCoords ? lat : null,
      lng: hasCoords ? lng : null,
    };
    // "finalidade": aluguel, venda/compra or ambos; without it, whichever price is filled decides.
    const purpose = normalizeText(get("finalidade"));
    const wantsRent = purpose ? /alug|ambos|locac/.test(purpose) : Boolean(draft.rentCents);
    const wantsSale = purpose ? /vend|compr|ambos/.test(purpose) : Boolean(draft.salePriceCents);
    if (wantsRent && !draft.rentCents) return errors.push({ line, error: "aluguel ausente ou inválido" });
    if (wantsSale && !draft.salePriceCents) return errors.push({ line, error: "preço de venda ausente ou inválido" });
    if (!wantsRent && !wantsSale) return errors.push({ line, error: "informe o aluguel ou o preço de venda" });
    draft.purposes = [...(wantsRent ? (["aluguel"] as const) : []), ...(wantsSale ? (["compra"] as const) : [])];
    if (!wantsRent) draft.rentCents = null;
    if (!wantsSale) draft.salePriceCents = null;
    if (!draft.neighborhood && !draft.street && !hasCoords) return errors.push({ line, error: "informe pelo menos o bairro" });
    if (!inScope(draft)) return errors.push({ line, error: "fora de Belo Horizonte" });
    const valid = normalizedListingSchema.safeParse(withImpliedFeatures(draft));
    if (!valid.success) return errors.push({ line, error: `campo inválido: ${valid.error.issues[0]?.path.join(".")}` });
    out.set(valid.data.externalId, valid.data);
  });
  return { ok: true, listings: [...out.values()], errors };
}
