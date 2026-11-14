import type { AddLayerObject, ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";

/** Overlay keys the map can show: MAP_LAYERS toggles + the clickable bairro points. */
export type OverlayKey = "sgb_inundacao" | "sgb_movimento_massa" | "sgb_enxurrada" | "importadas" | "curso_dagua" | "via_principal" | "ferrovia" | "metro" | "servicos" | "parque" | "regionais" | "bairros";

export type LegendEntry = { color: string; label: string; shape: "fill" | "line" | "dash" | "dot" };

const byLevel = (c3: string, c2: string, c1: string): ExpressionSpecification => ["match", ["get", "level"], 3, c3, 2, c2, c1];
const TEXT_FONT = ["Noto Sans Regular"];

/** Layers drawn for each overlay (all read the source `ov-<key>`). */
export function overlayLayers(key: OverlayKey): AddLayerObject[] {
  const src = `ov-${key}`;
  const id = (n: string) => `ov-${key}-${n}`;
  const isPoly: ExpressionSpecification = ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]];
  const isPoint: ExpressionSpecification = ["==", ["geometry-type"], "Point"];
  switch (key) {
    case "sgb_inundacao":
      return [{ id: id("fill"), type: "fill", source: src, paint: { "fill-color": byLevel("#1d4ed8", "#3b82f6", "#93c5fd"), "fill-opacity": ["match", ["get", "level"], 3, 0.45, 2, 0.28, 0.12] } }];
    case "sgb_movimento_massa":
      return [{ id: id("fill"), type: "fill", source: src, paint: { "fill-color": byLevel("#b45309", "#f59e0b", "#fcd34d"), "fill-opacity": ["match", ["get", "level"], 3, 0.45, 2, 0.2, 0.04] } }];
    case "sgb_enxurrada":
      return [{ id: id("fill"), type: "fill", source: src, paint: { "fill-color": "#7c3aed", "fill-opacity": 0.22 } }, { id: id("line"), type: "line", source: src, paint: { "line-color": "#7c3aed", "line-width": 1 } }];
    case "importadas": {
      const color: ExpressionSpecification = ["match", ["get", "category"], "risco_mapeado", "#dc2626", "ocorrencia_historica", "#db2777", "#ea580c"];
      return [
        { id: id("fill"), type: "fill", source: src, filter: isPoly, paint: { "fill-color": color, "fill-opacity": 0.3 } },
        { id: id("line"), type: "line", source: src, filter: ["!", isPoint], paint: { "line-color": color, "line-width": 1.5 } },
        { id: id("pt"), type: "circle", source: src, filter: isPoint, paint: { "circle-color": color, "circle-radius": 5, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } },
      ];
    }
    case "curso_dagua":
      return [
        { id: id("open"), type: "line", source: src, filter: ["==", ["get", "kind"], "curso_dagua"], paint: { "line-color": "#0ea5e9", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.2, 15, 3] } },
        { id: id("canal"), type: "line", source: src, filter: ["==", ["get", "kind"], "curso_dagua_canalizado"], paint: { "line-color": "#0369a1", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 15, 2.5], "line-dasharray": [2, 1.5] } },
      ];
    case "via_principal":
      return [{ id: id("line"), type: "line", source: src, paint: { "line-color": "#f97316", "line-opacity": 0.75, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.5, 15, 4] } }];
    case "ferrovia":
      return [{ id: id("line"), type: "line", source: src, paint: { "line-color": "#334155", "line-width": 2, "line-dasharray": [3, 2] } }];
    case "metro":
      return [
        { id: id("pt"), type: "circle", source: src, paint: { "circle-color": ["match", ["get", "kind"], "metro", "#2563eb", "#0891b2"], "circle-radius": ["match", ["get", "kind"], "metro", 6, 4.5], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
        { id: id("label"), type: "symbol", source: src, minzoom: 13, layout: { "text-field": ["get", "name"], "text-font": TEXT_FONT, "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#1e3a8a", "text-halo-color": "#fff", "text-halo-width": 1.5 } },
      ];
    case "servicos":
      return [
        { id: id("pt"), type: "circle", source: src, paint: { "circle-color": ["match", ["get", "kind"], "hospital", "#dc2626", "supermercado", "#16a34a", "#9333ea"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 15, 6], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } },
        { id: id("label"), type: "symbol", source: src, minzoom: 14.5, layout: { "text-field": ["get", "name"], "text-font": TEXT_FONT, "text-size": 10, "text-offset": [0, 1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#334155", "text-halo-color": "#fff", "text-halo-width": 1.5 } },
      ];
    case "parque":
      return [
        { id: id("fill"), type: "fill", source: src, filter: isPoly, paint: { "fill-color": "#22c55e", "fill-opacity": 0.28 } },
        { id: id("pt"), type: "circle", source: src, filter: isPoint, paint: { "circle-color": "#16a34a", "circle-radius": 3.5, "circle-stroke-color": "#fff", "circle-stroke-width": 1 } },
      ];
    case "regionais":
      return [
        { id: id("fill"), type: "fill", source: src, paint: { "fill-color": "#2563eb", "fill-opacity": 0.02 } },
        { id: id("line"), type: "line", source: src, paint: { "line-color": "#475569", "line-width": 1.6, "line-dasharray": [4, 2] } },
        { id: id("label"), type: "symbol", source: src, layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-transform": "uppercase", "text-letter-spacing": 0.08 }, paint: { "text-color": "#475569", "text-halo-color": "#fff", "text-halo-width": 2, "text-opacity": 0.85 } },
      ];
    case "bairros":
      return [
        { id: id("pt"), type: "circle", source: src, paint: { "circle-color": "#64748b", "circle-radius": 5, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } },
        { id: id("label"), type: "symbol", source: src, minzoom: 12, layout: { "text-field": ["get", "name"], "text-font": TEXT_FONT, "text-size": 11, "text-offset": [0, 0.9], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#1e293b", "text-halo-color": "#fff", "text-halo-width": 1.5 } },
      ];
  }
}

/** Legend rows of each overlay (and what each colour means). */
export const LEGEND: Record<OverlayKey, { title: string; note?: string; entries: LegendEntry[] }> = {
  sgb_inundacao: { title: "Inundação", note: "Suscetibilidade (SGB/IPT, 2014)", entries: [{ color: "#1d4ed8", label: "Alta", shape: "fill" }, { color: "#3b82f6", label: "Média", shape: "fill" }, { color: "#93c5fd", label: "Baixa", shape: "fill" }] },
  sgb_movimento_massa: { title: "Deslizamento", note: "Suscetibilidade (SGB/IPT, 2014)", entries: [{ color: "#b45309", label: "Alta", shape: "fill" }, { color: "#f59e0b", label: "Média", shape: "fill" }, { color: "#fcd34d", label: "Baixa", shape: "fill" }] },
  sgb_enxurrada: { title: "Enxurrada", note: "Bacias suscetíveis (SGB/IPT)", entries: [{ color: "#7c3aed", label: "Suscetível", shape: "fill" }] },
  importadas: { title: "Áreas oficiais", note: "Risco mapeado e ocorrências importadas", entries: [{ color: "#dc2626", label: "Risco mapeado", shape: "fill" }, { color: "#db2777", label: "Ocorrência histórica", shape: "fill" }] },
  curso_dagua: { title: "Cursos d'água", note: "OpenStreetMap", entries: [{ color: "#0ea5e9", label: "Aberto", shape: "line" }, { color: "#0369a1", label: "Canalizado", shape: "dash" }] },
  via_principal: { title: "Avenidas de grande circulação", entries: [{ color: "#f97316", label: "Tráfego intenso", shape: "line" }] },
  ferrovia: { title: "Ferrovias", entries: [{ color: "#334155", label: "Linha férrea", shape: "dash" }] },
  metro: { title: "Transporte", entries: [{ color: "#2563eb", label: "Metrô", shape: "dot" }, { color: "#0891b2", label: "Estação de ônibus/BRT", shape: "dot" }] },
  servicos: { title: "Serviços", entries: [{ color: "#dc2626", label: "Hospital", shape: "dot" }, { color: "#16a34a", label: "Supermercado", shape: "dot" }, { color: "#9333ea", label: "Farmácia", shape: "dot" }] },
  parque: { title: "Áreas verdes", entries: [{ color: "#22c55e", label: "Parque", shape: "fill" }] },
  regionais: { title: "Regionais", note: "Clique para filtrar", entries: [{ color: "#475569", label: "Limite", shape: "dash" }] },
  bairros: { title: "Bairros", note: "Clique para filtrar", entries: [{ color: "#64748b", label: "Bairro", shape: "dot" }, { color: "#2563eb", label: "Selecionado", shape: "dot" }] },
};

const cache = new Map<OverlayKey, Promise<GeoJSON.FeatureCollection>>();

export function fetchOverlay(key: OverlayKey): Promise<GeoJSON.FeatureCollection> {
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/camadas/${key}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<GeoJSON.FeatureCollection>;
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** First symbol layer of the base style: polygons and lines go below it (labels stay readable). */
export function firstLabelLayer(map: MapLibreMap): string | undefined {
  return map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
}

export function addOverlay(map: MapLibreMap, key: OverlayKey, data: GeoJSON.FeatureCollection) {
  const src = `ov-${key}`;
  if (!map.getSource(src)) map.addSource(src, { type: "geojson", data });
  const label = firstLabelLayer(map);
  for (const layer of overlayLayers(key)) {
    if (map.getLayer(layer.id)) continue;
    const below = layer.type === "fill" || layer.type === "line" ? label : map.getLayer("clusters") ? "clusters" : undefined;
    map.addLayer(layer, below);
  }
}

export function removeOverlay(map: MapLibreMap, key: OverlayKey) {
  for (const layer of overlayLayers(key)) if (map.getLayer(layer.id)) map.removeLayer(layer.id);
  if (map.getSource(`ov-${key}`)) map.removeSource(`ov-${key}`);
}
