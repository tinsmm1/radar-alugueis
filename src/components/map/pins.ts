import type { Map as MapLibreMap } from "maplibre-gl";

/** Risk colours of the pins (same hues as the --risk-* tokens, as canvas-safe hex). */
export const PIN_RISK: Record<string, { color: string; label: string }> = {
  baixo: { color: "#2e9e5b", label: "Risco baixo" },
  moderado: { color: "#d4a20f", label: "Moderado" },
  atencao: { color: "#e5761c", label: "Atenção" },
  alto: { color: "#dc2626", label: "Alto" },
  none: { color: "#94a3b8", label: "Sem análise" },
};

export const PRIMARY = "#2563eb";
export const DEMO_FILL = "#f3e8ff";

const RATIO = 2;
const W = 64;
const H = 44;

function draw(border: string, fill: string, dashed: boolean, width = 2.5): ImageData {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const lw = width * RATIO;
  const r = (H - lw) / 2;
  ctx.beginPath();
  ctx.roundRect(lw / 2, lw / 2, W - lw, H - lw, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = border;
  if (dashed) ctx.setLineDash([5 * RATIO, 3 * RATIO]);
  ctx.stroke();
  return ctx.getImageData(0, 0, W, H);
}

const META = { pixelRatio: RATIO, stretchX: [[22, 42]] as [number, number][], stretchY: [[20, 24]] as [number, number][], content: [16, 8, 48, 36] as [number, number, number, number] };

/** Pin image id for a point (risk border, dashed when approximate, lilac when demo). */
export function pinId(risk: string | null, approximate: boolean, demo: boolean): string {
  return `pin-${risk && PIN_RISK[risk] ? risk : "none"}-${approximate ? 1 : 0}-${demo ? 1 : 0}`;
}

/** Registers every pin variant plus the hover and selected pins. */
export function addPinImages(map: MapLibreMap) {
  for (const risk of Object.keys(PIN_RISK)) {
    for (const approx of [false, true]) {
      for (const demo of [false, true]) {
        const id = pinId(risk, approx, demo);
        if (!map.hasImage(id)) map.addImage(id, draw(PIN_RISK[risk].color, demo ? DEMO_FILL : "#ffffff", approx), META);
      }
    }
  }
  if (!map.hasImage("pin-hover")) map.addImage("pin-hover", draw(PRIMARY, "#eff6ff", false, 3), META);
  if (!map.hasImage("pin-selected")) map.addImage("pin-selected", draw("#1e3a8a", PRIMARY, false, 2), META);
}

const compact = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

/** "R$ 3,2 mil" from cents (total when known, else rent). */
export function priceLabel(totalCents: number | null, rentCents: number | null): string {
  const v = totalCents ?? rentCents;
  return v == null ? "—" : compact.format(v / 100).replace(/ /g, " ");
}

/** A 64-point polygon approximating a circle of `km` around a point (distance filter). */
export function circlePolygon(lat: number, lng: number, km: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}
