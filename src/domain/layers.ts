/** Catalogue of the geographic layers the analysis can use (metadata only, no I/O). */

export type LayerCategory = "risco_mapeado" | "suscetibilidade" | "ocorrencia_historica" | "infraestrutura";

export const CATEGORY_LABEL: Record<LayerCategory, string> = {
  risco_mapeado: "Risco oficialmente mapeado",
  suscetibilidade: "Suscetibilidade geográfica",
  ocorrencia_historica: "Ocorrência histórica",
  infraestrutura: "Infraestrutura e entorno",
};

export const CATEGORY_HELP: Record<LayerCategory, string> = {
  risco_mapeado: "Área delimitada por órgão público como de risco (ex.: setores de risco geológico). Indica perigo identificado em vistoria.",
  suscetibilidade: "Predisposição natural do terreno a um processo (inundação, deslizamento), estimada por modelagem. Não é uma vistoria do imóvel.",
  ocorrencia_historica: "Registro de evento que já aconteceu no local (alagamento, deslizamento). Não prevê o futuro, mas indica recorrência.",
  infraestrutura: "Elementos urbanos ao redor: vias, transporte, serviços, áreas verdes e fontes de ruído.",
};

export type RiskLayerKey = "sgb_inundacao" | "sgb_movimento_massa" | "sgb_enxurrada" | "sgb_risco_geologico";

export type LayerSource = { title: string; source: string; url: string; date: string; category: LayerCategory };

const SGB_URL = "https://geoservicos.sgb.gov.br/geoserver/web/";

export const RISK_LAYERS: Record<RiskLayerKey, LayerSource> = {
  sgb_inundacao: { title: "Suscetibilidade a inundação", source: "SGB/CPRM e IPT: Cartas de Suscetibilidade a Movimentos Gravitacionais de Massa e Inundações", url: SGB_URL, date: "2014", category: "suscetibilidade" },
  sgb_movimento_massa: { title: "Suscetibilidade a deslizamento (movimento de massa)", source: "SGB/CPRM e IPT: Cartas de Suscetibilidade a Movimentos Gravitacionais de Massa e Inundações", url: SGB_URL, date: "2014", category: "suscetibilidade" },
  sgb_enxurrada: { title: "Bacias suscetíveis a enxurrada", source: "SGB/CPRM e IPT: Cartas de Suscetibilidade a Movimentos Gravitacionais de Massa e Inundações", url: SGB_URL, date: "2014", category: "suscetibilidade" },
  sgb_risco_geologico: { title: "Setores de risco geológico", source: "SGB/CPRM: Setorização de Áreas de Risco Geológico", url: SGB_URL, date: "data de cada setor", category: "risco_mapeado" },
};

export const OSM_SOURCE = { source: "OpenStreetMap (ODbL), via OpenFreeMap", url: "https://www.openstreetmap.org/copyright" } as const;
export const TERRAIN_SOURCE = { source: "Terrain Tiles (AWS Open Data; SRTM/NASA, ~30 m)", url: "https://registry.opendata.aws/terrain-tiles/" } as const;

/** Urban feature kinds extracted from OpenStreetMap. */
export const URBAN_KINDS = [
  "curso_dagua", "curso_dagua_canalizado", "via_principal", "ferrovia", "aeroporto", "industrial", "metro", "estacao_onibus",
  "hospital", "supermercado", "farmacia", "parque", "escola", "equipamento_publico",
] as const;
export type UrbanKind = (typeof URBAN_KINDS)[number];

export const URBAN_LABEL: Record<UrbanKind, string> = {
  curso_dagua: "Rio ou córrego (aberto)",
  curso_dagua_canalizado: "Córrego canalizado",
  via_principal: "Avenida de grande circulação",
  ferrovia: "Ferrovia",
  aeroporto: "Aeroporto",
  industrial: "Área industrial",
  metro: "Estação de metrô",
  estacao_onibus: "Estação de ônibus/BRT",
  hospital: "Hospital",
  supermercado: "Supermercado",
  farmacia: "Farmácia",
  parque: "Parque ou área verde",
  escola: "Escola",
  equipamento_publico: "Equipamento público",
};

/** Map layers the user can switch on (risk first). */
export const MAP_LAYERS = [
  { key: "sgb_inundacao", label: "Inundação (suscetibilidade)", group: "risco" },
  { key: "sgb_movimento_massa", label: "Deslizamento (suscetibilidade)", group: "risco" },
  { key: "sgb_enxurrada", label: "Enxurrada (suscetibilidade)", group: "risco" },
  { key: "importadas", label: "Áreas importadas (PBH/Defesa Civil)", group: "risco" },
  { key: "curso_dagua", label: "Rios e córregos", group: "risco" },
  { key: "via_principal", label: "Avenidas de grande circulação", group: "urbano" },
  { key: "ferrovia", label: "Ferrovias", group: "urbano" },
  { key: "metro", label: "Metrô e estações BRT", group: "urbano" },
  { key: "servicos", label: "Hospitais, mercados e farmácias", group: "urbano" },
  { key: "parque", label: "Parques e áreas verdes", group: "urbano" },
  { key: "regionais", label: "Regionais de BH", group: "limites" },
] as const;
export type MapLayerKey = (typeof MAP_LAYERS)[number]["key"];

/** SGB class → ordinal level (3 = Alta). */
export function classLevel(cls: string | null | undefined): 0 | 1 | 2 | 3 {
  const c = (cls ?? "").toLowerCase();
  if (c.startsWith("alt") || c.startsWith("muito alt")) return 3;
  if (c.startsWith("méd") || c.startsWith("med")) return 2;
  if (c.startsWith("baix") || c.startsWith("suscet")) return c.startsWith("suscet") ? 2 : 1;
  return 0;
}
