import { z } from "zod";
import { FEATURE_LABEL, FEATURES, MODES, PROPERTY_TYPES, TYPE_LABEL, type Mode } from "./listing";
import { parseBbox } from "./geo";

export const SORTS = ["relevancia", "menor_total", "menor_aluguel", "menor_m2", "menor_preco", "menor_preco_m2", "maior_rendimento", "maior_area", "recentes", "maior_reducao", "menor_risco", "oportunidade", "melhor_avaliacao"] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABEL: Record<Sort, string> = {
  relevancia: "Mais relevantes",
  menor_total: "Menor custo total",
  menor_aluguel: "Menor aluguel",
  menor_m2: "Menor custo por m²",
  menor_preco: "Menor preço",
  menor_preco_m2: "Menor preço por m²",
  maior_rendimento: "Maior rendimento estimado",
  maior_area: "Maior área",
  recentes: "Mais recentes",
  maior_reducao: "Maior redução de preço",
  menor_risco: "Menor índice de risco",
  oportunidade: "Melhores oportunidades",
  melhor_avaliacao: "Melhor avaliação",
};

/** Sort options offered in each mode. */
export const SORTS_BY_MODE: Record<Mode, Sort[]> = {
  aluguel: ["relevancia", "melhor_avaliacao", "menor_total", "menor_aluguel", "menor_m2", "maior_area", "recentes", "maior_reducao", "menor_risco", "oportunidade"],
  compra: ["relevancia", "melhor_avaliacao", "menor_preco", "menor_preco_m2", "maior_rendimento", "maior_area", "recentes", "maior_reducao", "menor_risco", "oportunidade"],
};

const money = z.int().min(0).max(1_000_000).optional(); // reais
const count = z.int().min(0).max(20).optional();
const list = (max = 60) => z.array(z.string().min(1).max(80)).max(max).default([]);

export const filterSchema = z.object({
  /** Hub mode: rent or buy. Financial filters and sorts depend on it. */
  modo: z.enum(MODES).default("aluguel"),
  q: z.string().trim().max(120).optional(),
  bairros: list(),
  regionais: list(12),
  /** Distance search: centre "lat,lng" and radius in km. */
  perto: z.string().regex(/^-?\d{1,2}\.\d+,-?\d{1,3}\.\d+$/).optional(),
  pertoNome: z.string().max(120).optional(),
  raioKm: z.number().min(0.2).max(30).optional(),
  bbox: z.string().max(80).optional(),
  aluguelMin: money,
  aluguelMax: money,
  condoMin: money,
  condoMax: money,
  iptuMin: money,
  iptuMax: money,
  totalMin: money,
  totalMax: money,
  m2Max: money,
  /** Buy mode: asking price (reais), price per m² (reais) and minimum gross yield (% a.a.). */
  precoMin: z.int().min(0).max(100_000_000).optional(),
  precoMax: z.int().min(0).max(100_000_000).optional(),
  precoM2Max: z.int().min(0).max(1_000_000).optional(),
  rendimentoMin: z.number().min(0).max(30).optional(),
  areaMin: z.int().min(0).max(5000).optional(),
  areaMax: z.int().min(0).max(5000).optional(),
  quartosMin: count,
  quartosMax: count,
  suitesMin: count,
  banheirosMin: count,
  vagasMin: count,
  tipos: z.array(z.enum(PROPERTY_TYPES)).default([]),
  caracteristicas: z.array(z.enum(FEATURES)).default([]),
  recentesDias: z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(30)]).optional(),
  atualizadosDias: z.union([z.literal(1), z.literal(3), z.literal(7)]).optional(),
  reducao: z.boolean().default(false),
  anunciante: z.enum(["proprietario", "imobiliaria"]).optional(),
  localizacao: z.enum(["confirmada", "aproximada"]).optional(),
  custoCompleto: z.boolean().default(false),
  riscoMax: z.enum(["baixo", "moderado", "atencao"]).optional(),
  /** Minimum grade of the critical evaluation in the current mode (A ≥ 80, B ≥ 65, C ≥ 50). */
  notaMin: z.enum(["A", "B", "C"]).optional(),
  semInundacao: z.boolean().default(false),
  oportunidades: z.boolean().default(false),
  incluirIndisponiveis: z.boolean().default(false),
  favoritos: z.boolean().default(false),
  fontes: z.array(z.string().max(60)).max(20).default([]),
  ordem: z.enum(SORTS).default("relevancia"),
});
export type Filter = z.infer<typeof filterSchema>;
export const EMPTY_FILTER: Filter = filterSchema.parse({});

const LISTS = ["bairros", "regionais", "tipos", "caracteristicas", "fontes"] as const;
const NUMBERS = [
  "aluguelMin", "aluguelMax", "condoMin", "condoMax", "iptuMin", "iptuMax", "totalMin", "totalMax", "m2Max", "areaMin", "areaMax",
  "quartosMin", "quartosMax", "suitesMin", "banheirosMin", "vagasMin", "recentesDias", "atualizadosDias", "raioKm",
  "precoMin", "precoMax", "precoM2Max", "rendimentoMin",
] as const;
const FLAGS = ["reducao", "custoCompleto", "semInundacao", "oportunidades", "incluirIndisponiveis", "favoritos"] as const;
const STRINGS = ["modo", "q", "perto", "pertoNome", "bbox", "anunciante", "localizacao", "riscoMax", "notaMin", "ordem"] as const;

type Params = { get(name: string): string | null; getAll(name: string): string[] };

/** URL search params → Filter; invalid parts are dropped one by one, never the whole filter. */
export function filterFromParams(params: Params): Filter {
  const raw: Record<string, unknown> = {};
  for (const k of LISTS) {
    const values = params.getAll(k).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
    if (values.length) raw[k] = values;
  }
  for (const k of NUMBERS) {
    const v = params.get(k);
    if (v != null && v !== "" && Number.isFinite(Number(v))) raw[k] = Number(v);
  }
  for (const k of FLAGS) if (params.get(k) === "1") raw[k] = true;
  for (const k of STRINGS) {
    const v = params.get(k);
    if (v) raw[k] = v;
  }
  const full = filterSchema.safeParse(raw);
  if (full.success) return full.data;
  const keep: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const one = filterSchema.safeParse({ [k]: v });
    if (one.success) keep[k] = v;
  }
  return filterSchema.parse(keep);
}

/** Filter → compact URL params (defaults omitted). */
export function filterToParams(f: Filter): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of STRINGS) {
    const v = f[k];
    if (v && !(k === "ordem" && v === "relevancia") && !(k === "modo" && v === "aluguel")) p.set(k, String(v));
  }
  for (const k of LISTS) if (f[k].length) p.set(k, f[k].join(","));
  for (const k of NUMBERS) if (f[k] != null) p.set(k, String(f[k]));
  for (const k of FLAGS) if (f[k]) p.set(k, "1");
  return p;
}

/** How many criteria are active (badge on the filter button); sort and map area not counted. */
export function activeCount(f: Filter): number {
  let n = 0;
  // The mode is the context, not a criterion.
  for (const k of LISTS) if (f[k].length) n++;
  for (const k of NUMBERS) if (f[k] != null && k !== "raioKm") n++;
  for (const k of FLAGS) if (f[k]) n++;
  for (const k of ["q", "perto", "anunciante", "localizacao", "riscoMax", "notaMin"] as const) if (f[k]) n++;
  return n;
}

const reais = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;
const range = (label: string, min?: number, max?: number, fmt = reais) =>
  min != null && max != null ? `${label} ${fmt(min)}–${fmt(max)}` : min != null ? `${label} ≥ ${fmt(min)}` : max != null ? `${label} ≤ ${fmt(max)}` : null;

/** Human summary for saved searches and emails. */
export function describeFilter(f: Filter): string {
  const parts = [
    f.modo === "compra" ? "Comprar" : "Alugar",
    f.q && `"${f.q}"`,
    f.bairros.length && (f.bairros.length <= 3 ? f.bairros.join(", ") : `${f.bairros.length} bairros`),
    f.regionais.length && `Regional ${f.regionais.join(", ")}`,
    f.perto && `até ${f.raioKm ?? 2} km de ${f.pertoNome ?? "um ponto"}`,
    f.bbox && parseBbox(f.bbox) && "área do mapa",
    f.tipos.length && f.tipos.map((t) => TYPE_LABEL[t]).join(", "),
    range("aluguel", f.aluguelMin, f.aluguelMax),
    range("condomínio", f.condoMin, f.condoMax),
    range("IPTU/mês", f.iptuMin, f.iptuMax),
    range("total", f.totalMin, f.totalMax),
    range("preço", f.precoMin, f.precoMax),
    f.precoM2Max != null && `até ${reais(f.precoM2Max)}/m²`,
    f.rendimentoMin != null && `rendimento ≥ ${f.rendimentoMin.toLocaleString("pt-BR")}% a.a.`,
    f.m2Max != null && `até ${reais(f.m2Max)}/m²`,
    range("área", f.areaMin, f.areaMax, (v) => `${v} m²`),
    range("quartos", f.quartosMin, f.quartosMax, String),
    f.suitesMin && `${f.suitesMin}+ suítes`,
    f.banheirosMin && `${f.banheirosMin}+ banheiros`,
    f.vagasMin && `${f.vagasMin}+ vagas`,
    f.caracteristicas.length && f.caracteristicas.map((c) => FEATURE_LABEL[c]).join(", "),
    f.recentesDias && `anunciados em ${f.recentesDias} dia(s)`,
    f.atualizadosDias && `atualizados em ${f.atualizadosDias} dia(s)`,
    f.reducao && "com redução de preço",
    f.anunciante && (f.anunciante === "proprietario" ? "direto com proprietário" : "de imobiliárias"),
    f.localizacao && (f.localizacao === "confirmada" ? "endereço confirmado" : "localização aproximada"),
    f.custoCompleto && "custo completo",
    f.riscoMax && `risco até ${f.riscoMax}`,
    f.notaMin && `avaliação ${f.notaMin}${f.notaMin === "A" ? "" : " ou melhor"}`,
    f.semInundacao && "fora de suscetibilidade a inundação",
    f.oportunidades && "oportunidades",
    f.favoritos && "favoritos",
  ].filter(Boolean);
  return parts.length > 1 ? parts.join(" · ") : `${parts[0]}: todos os imóveis`;
}

/** Link to the search with this filter; the mode is always explicit so a remembered mode never overrides it. */
export function searchHref(f: Filter): string {
  const p = filterToParams(f);
  p.set("modo", f.modo);
  return `/?${p.toString()}`;
}
