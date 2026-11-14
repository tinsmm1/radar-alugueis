"use client";
import { useEffect, useRef } from "react";
import type { Map as MlMap } from "maplibre-gl";
import { loadMaplibre } from "@/lib/maplibre";

const STYLE = "https://tiles.openfreemap.org/styles/positron";

/** Circle polygon (~radius metres) as GeoJSON, for approximate locations. */
function circle(lng: number, lat: number, radius: number) {
  const coords: Array<[number, number]> = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI;
    coords.push([lng + (radius / (111_320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (radius / 110_540) * Math.sin(a)]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [coords] } };
}

/** Small map of the property: exact point as a marker, approximate location as a ~300 m circle. */
export function MiniMap({ lat, lng, approximate }: { lat: number; lng: number; approximate: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: MlMap | null = null;
    let cancelled = false;
    void loadMaplibre().then((ml) => {
      if (cancelled || !el.current) return;
      const m = new ml.Map({ container: el.current, style: STYLE, center: [lng, lat], zoom: approximate ? 14 : 15.5, attributionControl: { compact: true }, cooperativeGestures: true });
      map = m;
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      if (approximate) {
        m.on("load", () => {
          m.addSource("approx", { type: "geojson", data: circle(lng, lat, 300) });
          m.addLayer({ id: "approx-fill", type: "fill", source: "approx", paint: { "fill-color": "#2563eb", "fill-opacity": 0.12 } });
          m.addLayer({ id: "approx-line", type: "line", source: "approx", paint: { "line-color": "#2563eb", "line-width": 2, "line-dasharray": [2, 2] } });
        });
      } else {
        new ml.Marker({ color: "#2563eb" }).setLngLat([lng, lat]).addTo(m);
      }
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, approximate]);
  return <div ref={el} className="h-64 w-full overflow-hidden rounded-xl border" role="img" aria-label={approximate ? "Mapa com a localização aproximada do imóvel" : "Mapa com a localização do imóvel"} />;
}
