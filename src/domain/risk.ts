import { CATEGORY_LABEL, OSM_SOURCE, RISK_LAYERS, TERRAIN_SOURCE, URBAN_LABEL, type LayerCategory, type UrbanKind } from "./layers";
import { meters } from "./money";

/** Facts measured for one location (from PostGIS and terrain); null = no data. */
export type LocationFacts = {
  precision: "exata" | "aproximada";
  /** Which data sets were loaded when the analysis ran (missing → "sem dados"). */
  coverage: { sgb: boolean; osm: boolean; terrain: boolean; imported: boolean };
  flood: SusceptibilityFact | null;
  landslide: SusceptibilityFact | null;
  flashFlood: { inside: boolean } | null;
  mapped: Array<{ name: string; category: Exclude<LayerCategory, "infraestrutura" | "suscetibilidade">; source: string; url: string | null; date: string | null; distanceM: number }>;
  slopePct: number | null;
  nearest: Partial<Record<UrbanKind, { distanceM: number; name: string | null } | null>>;
  analyzedAt: string;
};

export type SusceptibilityFact = { insideClass: string | null; insideLevel: 0 | 1 | 2 | 3; nearHighM: number | null };

export type ItemLevel = "alto" | "atencao" | "moderado" | "baixo" | "positivo" | "neutro" | "sem_dados";

export const LEVEL_LABEL: Record<ItemLevel, string> = {
  alto: "Alto",
  atencao: "Atenção",
  moderado: "Moderado",
  baixo: "Baixo segundo a base consultada",
  positivo: "Ponto positivo",
  neutro: "Informativo",
  sem_dados: "Sem dados suficientes",
};

export type AnalysisItem = {
  key: string;
  group: "ambiental" | "urbano" | "servicos";
  title: string;
  level: ItemLevel;
  description: string;
  distanceM: number | null;
  category: LayerCategory;
  source: string;
  sourceUrl: string | null;
  sourceDate: string | null;
};

export type RiskIndex = { score: number; level: "baixo" | "moderado" | "atencao" | "alto"; confidence: "normal" | "reduzida"; reasons: string[] };

export const NO_RECORD_NOTE = "A ausência de registro na base consultada não significa ausência de risco.";
export const INDEX_DISCLAIMER = "Resumo automático das bases consultadas. Não substitui vistoria nem avaliação técnica.";

function susceptibility(key: "sgb_inundacao" | "sgb_movimento_massa", title: string, f: SusceptibilityFact | null, has: boolean, at: string): AnalysisItem {
  const src = RISK_LAYERS[key];
  const base = { key, group: "ambiental" as const, title, category: src.category, source: src.source, sourceUrl: src.url, sourceDate: src.date };
  if (!has || !f) return { ...base, level: "sem_dados", description: `Camada não carregada no momento da análise (${at.slice(0, 10)}).`, distanceM: null };
  if (f.insideLevel === 3) return { ...base, level: "alto", description: `Dentro de área de suscetibilidade ${f.insideClass?.toLowerCase()} (modelagem do SGB/IPT).`, distanceM: 0 };
  if (f.insideLevel === 2) return { ...base, level: "atencao", description: `Dentro de área de suscetibilidade ${f.insideClass?.toLowerCase()} (modelagem do SGB/IPT).`, distanceM: 0 };
  if (f.nearHighM != null && f.nearHighM <= 150) return { ...base, level: "atencao", description: `Área de suscetibilidade alta a ${meters(f.nearHighM)}.`, distanceM: f.nearHighM };
  if (f.insideLevel === 1) return { ...base, level: "baixo", description: `Dentro de área de suscetibilidade baixa (classe mais comum na cidade, modelagem do SGB/IPT). ${NO_RECORD_NOTE}`, distanceM: 0 };
  return { ...base, level: "baixo", description: `Fora das áreas mapeadas como suscetíveis. ${NO_RECORD_NOTE}`, distanceM: f.nearHighM };
}

function urban(kind: UrbanKind, facts: LocationFacts, rule: (d: number) => ItemLevel | null, text: (d: number, name: string | null) => string, group: AnalysisItem["group"]): AnalysisItem | null {
  const base = { key: kind, group, title: URBAN_LABEL[kind], category: "infraestrutura" as const, source: OSM_SOURCE.source, sourceUrl: OSM_SOURCE.url, sourceDate: facts.analyzedAt.slice(0, 10) };
  if (!facts.coverage.osm) return { ...base, level: "sem_dados", description: "Camada do OpenStreetMap não carregada.", distanceM: null };
  const n = facts.nearest[kind];
  if (!n) return null;
  const level = rule(n.distanceM);
  return level ? { ...base, level, description: text(n.distanceM, n.name), distanceM: n.distanceM } : null;
}

const named = (label: string, d: number, name: string | null) => `${label}${name ? ` (${name})` : ""} ${d <= 10 ? "junto ao imóvel ou com o imóvel dentro da área" : `a ${meters(d)}`}.`;

/** Turns measured facts into the "Análise da localização" items, worst first within each group. */
export function analysisItems(f: LocationFacts): AnalysisItem[] {
  const items: AnalysisItem[] = [];
  items.push(susceptibility("sgb_inundacao", "Inundação e alagamento", f.flood, f.coverage.sgb, f.analyzedAt));
  items.push(susceptibility("sgb_movimento_massa", "Deslizamento (risco geológico)", f.landslide, f.coverage.sgb, f.analyzedAt));
  if (f.coverage.sgb && f.flashFlood?.inside) {
    const s = RISK_LAYERS.sgb_enxurrada;
    items.push({ key: "sgb_enxurrada", group: "ambiental", title: "Enxurrada", level: "atencao", description: "Dentro de bacia suscetível a enxurrada (escoamento rápido e violento em chuvas fortes).", distanceM: 0, category: s.category, source: s.source, sourceUrl: s.url, sourceDate: s.date });
  }
  for (const m of f.mapped) {
    const inside = m.distanceM <= 0;
    const level: ItemLevel = m.category === "risco_mapeado" ? (inside ? "alto" : "atencao") : inside ? "atencao" : "moderado";
    items.push({ key: `importada:${m.name}`, group: "ambiental", title: m.name, level, description: `${CATEGORY_LABEL[m.category]}: ${inside ? "o imóvel está dentro da área" : `a ${meters(m.distanceM)}`}.`, distanceM: m.distanceM, category: m.category, source: m.source, sourceUrl: m.url, sourceDate: m.date });
  }
  if (!f.coverage.imported) {
    items.push({ key: "pbh", group: "ambiental", title: "Áreas de risco e pontos de alagamento da PBH/Defesa Civil", level: "sem_dados", description: "Camadas oficiais da Prefeitura ainda não importadas (o servidor da PBH bloqueia acesso automático). Importe o GeoJSON em Administração.", distanceM: null, category: "risco_mapeado", source: "Prefeitura de Belo Horizonte", sourceUrl: "https://prefeitura.pbh.gov.br/defesa-civil", sourceDate: null });
  }
  const water = urban("curso_dagua", f, (d) => (d <= 50 ? "atencao" : d <= 150 ? "moderado" : d <= 400 ? "neutro" : null), (d, n) => named("Curso d'água aberto", d, n), "ambiental");
  if (water) items.push(water);
  const canal = urban("curso_dagua_canalizado", f, (d) => (d <= 50 ? "moderado" : d <= 200 ? "neutro" : null), (d, n) => `${named("Córrego canalizado", d, n)} Canais podem transbordar em chuvas intensas.`, "ambiental");
  if (canal) items.push(canal);
  if (!f.coverage.terrain || f.slopePct == null) {
    items.push({ key: "declividade", group: "ambiental", title: "Declividade do terreno", level: "sem_dados", description: "Relevo não disponível para este ponto.", distanceM: null, category: "suscetibilidade", source: TERRAIN_SOURCE.source, sourceUrl: TERRAIN_SOURCE.url, sourceDate: null });
  } else {
    const s = f.slopePct;
    const level: ItemLevel = s >= 30 ? "atencao" : s >= 15 ? "moderado" : "baixo";
    const text = s >= 30 ? "Declividade elevada (≥ 30%, limite da Lei 6.766/79 para parcelamento sem exigências específicas)." : s >= 15 ? "Terreno inclinado." : "Terreno pouco inclinado.";
    items.push({ key: "declividade", group: "ambiental", title: "Declividade do terreno", level, description: `${text} Estimativa de ${s.toLocaleString("pt-BR")}% com relevo de ~30 m de resolução.`, distanceM: null, category: "suscetibilidade", source: TERRAIN_SOURCE.source, sourceUrl: TERRAIN_SOURCE.url, sourceDate: null });
  }
  const push = (x: AnalysisItem | null) => x && items.push(x);
  push(urban("via_principal", f, (d) => (d <= 60 ? "atencao" : d <= 200 ? "neutro" : null), (d, n) => `${named("Avenida de grande circulação", d, n)} Ruído e tráfego intenso.`, "urbano"));
  push(urban("ferrovia", f, (d) => (d <= 150 ? "atencao" : d <= 400 ? "neutro" : null), (d) => `Ferrovia a ${meters(d)}: ruído e vibração.`, "urbano"));
  push(urban("aeroporto", f, (d) => (d <= 1500 ? "atencao" : d <= 3000 ? "neutro" : null), (d, n) => `${named("Aeroporto", d, n)} Fonte relevante de ruído.`, "urbano"));
  push(urban("industrial", f, (d) => (d <= 200 ? "moderado" : d <= 500 ? "neutro" : null), (d) => `Área industrial a ${meters(d)}.`, "urbano"));
  const good = (limit: number) => (d: number) => (d <= limit ? "positivo" : "neutro") as ItemLevel;
  push(urban("metro", f, (d) => (d <= 2000 ? good(800)(d) : null), (d, n) => named("Estação de metrô", d, n), "servicos"));
  push(urban("estacao_onibus", f, (d) => (d <= 1500 ? good(600)(d) : null), (d, n) => named("Estação de ônibus/BRT", d, n), "servicos"));
  push(urban("hospital", f, (d) => (d <= 3000 ? good(1500)(d) : null), (d, n) => named("Hospital", d, n), "servicos"));
  push(urban("supermercado", f, (d) => (d <= 2000 ? good(700)(d) : null), (d, n) => named("Supermercado", d, n), "servicos"));
  push(urban("farmacia", f, (d) => (d <= 1500 ? good(500)(d) : null), (d, n) => named("Farmácia", d, n), "servicos"));
  push(urban("parque", f, (d) => (d <= 1500 ? good(500)(d) : null), (d, n) => named("Parque ou área verde", d, n), "servicos"));
  push(urban("escola", f, (d) => (d <= 1500 ? "neutro" : null), (d, n) => named("Escola", d, n), "servicos"));
  const order: ItemLevel[] = ["alto", "atencao", "moderado", "sem_dados", "baixo", "positivo", "neutro"];
  const groups: AnalysisItem["group"][] = ["ambiental", "urbano", "servicos"];
  return items.sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || order.indexOf(a.level) - order.indexOf(b.level));
}

/** 0–100 summary of environmental and urban risk (higher = more attention needed). */
export function riskIndex(f: LocationFacts): RiskIndex {
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, why: string) => {
    score += points;
    reasons.push(why);
  };
  // The strongest reading of each process counts (inside a class, or a high class nearby).
  const strongest = (s: SusceptibilityFact | null, label: string, pts: [number, number, number, number]) => {
    if (!s) return;
    const options: Array<[number, string]> = [];
    if (s.insideLevel === 3) options.push([pts[0], `${label}: suscetibilidade alta`]);
    if (s.insideLevel === 2) options.push([pts[1], `${label}: suscetibilidade média`]);
    if (s.nearHighM != null && s.nearHighM <= 150 && s.insideLevel < 3) options.push([pts[2], `${label}: suscetibilidade alta a ${meters(s.nearHighM)}`]);
    if (s.insideLevel === 1) options.push([pts[3], `${label}: suscetibilidade baixa`]);
    const best = options.sort((a, b) => b[0] - a[0])[0];
    if (best && best[0] > 0) add(best[0], best[1]);
  };
  strongest(f.flood, "inundação", [35, 20, 12, 4]);
  strongest(f.landslide, "deslizamento", [30, 18, 10, 2]);
  if (f.flashFlood?.inside) add(10, "bacia suscetível a enxurrada");
  for (const m of f.mapped) {
    if (m.category === "risco_mapeado" && m.distanceM <= 0) add(40, `${m.name}: dentro da área`);
    else if (m.category === "risco_mapeado" && m.distanceM <= 100) add(15, `${m.name}: a ${meters(m.distanceM)}`);
    else if (m.category === "ocorrencia_historica" && m.distanceM <= 200) add(15, `${m.name}: a ${meters(m.distanceM)}`);
  }
  const w = f.nearest.curso_dagua?.distanceM;
  if (w != null && w <= 50) add(15, "curso d'água a menos de 50 m");
  else if (w != null && w <= 150) add(8, "curso d'água a menos de 150 m");
  const c = f.nearest.curso_dagua_canalizado?.distanceM;
  if (c != null && c <= 50) add(6, "córrego canalizado a menos de 50 m");
  if (f.slopePct != null && f.slopePct >= 30) add(15, "declividade ≥ 30%");
  else if (f.slopePct != null && f.slopePct >= 15) add(6, "terreno inclinado");
  const near = (k: UrbanKind, limit: number, pts: number, why: string) => {
    const d = f.nearest[k]?.distanceM;
    if (d != null && d <= limit) add(pts, why);
  };
  near("via_principal", 60, 6, "avenida de grande circulação ao lado");
  near("ferrovia", 150, 5, "ferrovia próxima");
  near("aeroporto", 1500, 6, "aeroporto próximo");
  near("industrial", 200, 5, "área industrial próxima");
  score = Math.min(100, score);
  const level = score >= 60 ? "alto" : score >= 35 ? "atencao" : score >= 15 ? "moderado" : "baixo";
  const confidence = f.precision === "aproximada" || !f.coverage.sgb || !f.coverage.osm ? "reduzida" : "normal";
  return { score, level, confidence, reasons };
}

export const INDEX_LABEL: Record<RiskIndex["level"], string> = { baixo: "Baixo", moderado: "Moderado", atencao: "Atenção", alto: "Alto" };
