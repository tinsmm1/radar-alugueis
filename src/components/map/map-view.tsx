"use client";
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap, Popup } from "maplibre-gl";
import { loadMaplibre } from "@/lib/maplibre";
import { BH_CENTER } from "@/domain/geo";
import type { MapPoint } from "@/server/search";
import { addOverlay, fetchOverlay, removeOverlay, type OverlayKey } from "./overlays";
import { addPinImages, circlePolygon, pinId, priceLabel, PRIMARY } from "./pins";
import { popupContent, type MiniCard } from "./popup";

export type MapViewProps = {
  query: string;
  selectedId: number | null;
  hoveredId: number | null;
  /** Changes when the list asks the map to fly to the selected property. */
  focusKey: number;
  onSelect: (id: number | null) => void;
  cards: Record<number, MiniCard>;
  overlays: OverlayKey[];
  bboxActive: boolean;
  onBbox: (bbox: string | null) => void;
  bairros: string[];
  regionais: string[];
  onToggleBairro: (name: string) => void;
  onToggleRegional: (name: string) => void;
  perto: { lat: number; lng: number; km: number } | null;
  onPoints?: (n: number) => void;
};

const STYLE = "https://tiles.openfreemap.org/styles/positron";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function toFeatures(points: MapPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      id: p.id,
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { id: p.id, price: priceLabel(p.totalCents, p.rentCents), pin: pinId(p.risk, p.precision !== "exata", p.demo), risk: p.risk, demo: p.demo, approx: p.precision !== "exata", total: p.totalCents, rent: p.rentCents },
    })),
  };
}

function addPropertyLayers(map: MapLibreMap) {
  map.addSource("props", { type: "geojson", data: EMPTY, cluster: true, clusterRadius: 44, clusterMaxZoom: 15 });
  map.addLayer({ id: "clusters", type: "circle", source: "props", filter: ["has", "point_count"], paint: { "circle-color": PRIMARY, "circle-opacity": 0.92, "circle-radius": ["step", ["get", "point_count"], 15, 10, 19, 40, 25], "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
  map.addLayer({ id: "cluster-count", type: "symbol", source: "props", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 12 }, paint: { "text-color": "#fff" } });
  const pill = (id: string, image: unknown, textColor: string) =>
    map.addLayer({
      id,
      type: "symbol",
      source: "props",
      filter: id === "pins" ? ["!", ["has", "point_count"]] : ["==", ["get", "id"], -1],
      layout: { "icon-image": image as string, "icon-text-fit": "both", "text-field": ["get", "price"], "text-font": ["Noto Sans Bold"], "text-size": 12, "icon-allow-overlap": true, "text-allow-overlap": true, "symbol-sort-key": ["case", ["get", "demo"], 1, 0] },
      paint: { "text-color": textColor },
    });
  pill("pins", ["get", "pin"], "#0f172a");
  pill("pins-hover", "pin-hover", "#1e3a8a");
  pill("pins-selected", "pin-selected", "#ffffff");
}

type Lib = Awaited<ReturnType<typeof loadMaplibre>>;
type Hooks = { latest: { current: MapViewProps }; onReady: () => void; onError: (msg: string) => void };

/** Creates the map, its property layers and the click/hover handlers (handlers read `latest`). */
function createMap(lib: Lib, container: HTMLDivElement, { latest, onReady, onError }: Hooks): MapLibreMap {
  const map = new lib.Map({ container, style: STYLE, center: [BH_CENTER.lng, BH_CENTER.lat], zoom: 11.2, minZoom: 9, maxZoom: 18, attributionControl: { compact: true }, cooperativeGestures: false });
  map.addControl(new lib.NavigationControl({ showCompass: false }), "bottom-right");
  map.on("load", () => {
    addPinImages(map);
    addPropertyLayers(map);
    map.on("click", "clusters", (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      // Zoom into the cluster; a failed lookup (source replaced meanwhile) just does nothing.
      (map.getSource("props") as GeoJSONSource)
        .getClusterExpansionZoom(f.properties.cluster_id as number)
        .then((zoom) => map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.5 }))
        .catch(() => undefined);
    });
    for (const layer of ["pins", "pins-hover", "pins-selected"]) {
      map.on("click", layer, (e: MapLayerMouseEvent) => {
        const id = Number(e.features?.[0]?.properties.id);
        if (Number.isFinite(id)) latest.current.onSelect(id);
      });
    }
    for (const layer of ["clusters", "pins", "pins-hover", "pins-selected", "ov-bairros-pt", "ov-regionais-fill"]) {
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }
    map.on("click", "ov-bairros-pt", (e: MapLayerMouseEvent) => {
      const name = e.features?.[0]?.properties.name as string | undefined;
      if (name) latest.current.onToggleBairro(name);
    });
    map.on("click", "ov-regionais-fill", (e: MapLayerMouseEvent) => {
      // A click on a property pin wins over the regional underneath.
      if (map.queryRenderedFeatures(e.point, { layers: ["pins", "clusters", "ov-bairros-pt"].filter((l) => map.getLayer(l)) }).length) return;
      const name = e.features?.[0]?.properties.name as string | undefined;
      if (name) latest.current.onToggleRegional(name);
    });
    map.on("moveend", () => {
      if (!latest.current.bboxActive) return;
      const b = map.getBounds();
      latest.current.onBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(4)).join(","));
    });
    onReady();
  });
  map.on("error", (e) => {
    if (/style|tiles|Failed to fetch/i.test(String(e.error?.message ?? ""))) onError("Não foi possível carregar o mapa base agora.");
  });
  return map;
}

/** MapLibre map of the search (client only). */
export default function MapView(props: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const latest = useRef(props);
  const points = useRef<Map<number, MapPoint>>(new Map());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ml = useRef<Awaited<ReturnType<typeof loadMaplibre>> | null>(null);
  useEffect(() => {
    latest.current = props;
  });

  // Create the map once.
  useEffect(() => {
    let disposed = false;
    let created: MapLibreMap | null = null;
    void loadMaplibre().then((lib) => {
      if (disposed || !el.current) return;
      ml.current = lib;
      created = createMap(lib, el.current, { latest, onReady: () => setReady(true), onError: setError });
      mapRef.current = created;
    }).catch(() => setError("Não foi possível carregar o mapa."));
    return () => {
      disposed = true;
      created?.remove();
      mapRef.current = null;
    };
  }, []);

  // Points for the current filter (refit unless the search follows the visible area).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const ctrl = new AbortController();
    fetch(`/api/mapa?${props.query}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ points: MapPoint[] }>) : Promise.reject(new Error(String(r.status)))))
      .then(({ points: list }) => {
        points.current = new Map(list.map((p) => [p.id, p]));
        void (map.getSource("props") as GeoJSONSource).setData(toFeatures(list));
        latest.current.onPoints?.(list.length);
        if (!latest.current.bboxActive && list.length) {
          const bounds = new ml.current!.LngLatBounds();
          for (const p of list) bounds.extend([p.lng, p.lat]);
          map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 });
        }
      })
      .catch((err: Error) => err.name !== "AbortError" && setError("Não foi possível carregar os imóveis no mapa."));
    return () => ctrl.abort();
  }, [ready, props.query]);

  // Hover and selection highlights.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setFilter("pins-hover", ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], props.hoveredId ?? -1]]);
    map.setFilter("pins-selected", ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], props.selectedId ?? -1]]);
  }, [ready, props.hoveredId, props.selectedId]);

  // Popup of the selected property; fly to it when the list asked for it.
  useEffect(() => {
    const map = mapRef.current;
    const old = popupRef.current;
    popupRef.current = null;
    old?.remove();
    if (!ready || !map || props.selectedId == null) return;
    const p = points.current.get(props.selectedId);
    if (!p) return;
    const popup = new ml.current!.Popup({ offset: 18, closeButton: true, maxWidth: "260px", className: "radar-popup" }).setLngLat([p.lng, p.lat]).setDOMContent(popupContent(p, latest.current.cards[p.id])).addTo(map);
    popup.on("close", () => popupRef.current === popup && latest.current.onSelect(null));
    popupRef.current = popup;
  }, [ready, props.selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const p = props.selectedId != null ? points.current.get(props.selectedId) : null;
    if (ready && map && p && props.focusKey > 0) map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 15), duration: 700 });
  }, [ready, props.focusKey, props.selectedId]);

  // Overlays on/off.
  const overlayKey = props.overlays.join(",");
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const wanted = new Set(overlayKey ? (overlayKey.split(",") as OverlayKey[]) : []);
    const all: OverlayKey[] = ["sgb_inundacao", "sgb_movimento_massa", "sgb_enxurrada", "importadas", "curso_dagua", "via_principal", "ferrovia", "metro", "servicos", "parque", "regionais", "bairros"];
    for (const key of all) if (!wanted.has(key)) removeOverlay(map, key);
    let alive = true;
    for (const key of wanted) {
      fetchOverlay(key)
        .then((data) => alive && mapRef.current === map && addOverlay(map, key, data))
        .catch(() => setError("Uma camada não pôde ser carregada."));
    }
    return () => {
      alive = false;
    };
  }, [ready, overlayKey]);

  // Selected bairros/regionais drawn in blue (styles re-applied when layers appear).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const apply = () => {
      if (map.getLayer("ov-bairros-pt")) map.setPaintProperty("ov-bairros-pt", "circle-color", ["case", ["in", ["get", "name"], ["literal", props.bairros]], PRIMARY, "#64748b"]);
      if (map.getLayer("ov-regionais-fill")) map.setPaintProperty("ov-regionais-fill", "fill-opacity", ["case", ["in", ["get", "name"], ["literal", props.regionais]], 0.12, 0.02]);
    };
    apply();
    map.on("styledata", apply);
    return () => {
      map.off("styledata", apply);
    };
  }, [ready, props.bairros, props.regionais]);

  // Distance filter circle.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const data: GeoJSON.FeatureCollection = props.perto ? { type: "FeatureCollection", features: [circlePolygon(props.perto.lat, props.perto.lng, props.perto.km)] } : EMPTY;
    if (props.perto) {
      const ring = (data.features[0].geometry as GeoJSON.Polygon).coordinates[0];
      const lngs = ring.map((c) => c[0]);
      const lats = ring.map((c) => c[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 40, duration: 600 });
    }
    const src = map.getSource("perto") as GeoJSONSource | undefined;
    if (src) void src.setData(data);
    else {
      map.addSource("perto", { type: "geojson", data });
      map.addLayer({ id: "perto-fill", type: "fill", source: "perto", paint: { "fill-color": PRIMARY, "fill-opacity": 0.06 } }, "clusters");
      map.addLayer({ id: "perto-line", type: "line", source: "perto", paint: { "line-color": PRIMARY, "line-width": 2, "line-dasharray": [2, 2] } }, "clusters");
    }
  }, [ready, props.perto]);

  // When "search this area" is switched on, apply the current view immediately.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !props.bboxActive) return;
    const b = map.getBounds();
    latest.current.onBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(4)).join(","));
  }, [ready, props.bboxActive]);

  return (
    <div className="relative size-full">
      <div ref={el} className="size-full" role="region" aria-label="Mapa dos imóveis de Belo Horizonte" />
      {error && <p className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-destructive px-3 py-1.5 text-xs text-white shadow">{error}</p>}
    </div>
  );
}
