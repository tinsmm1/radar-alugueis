import "server-only";
import { PNG } from "pngjs";
import { hornSlopePercent, metersPerPixel, terrariumElevation } from "@/domain/geo";
import { safeFetch } from "../http";

const TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const ZOOM = 14;
/** Samples ~3 px apart (~27 m at BH's latitude), close to the source's ~30 m resolution. */
const STEP = 3;

const cache = new Map<string, PNG | null>();

async function tile(x: number, y: number): Promise<PNG | null> {
  const key = `${x}/${y}`;
  if (cache.has(key)) return cache.get(key)!;
  if (cache.size > 64) cache.clear();
  const res = await safeFetch(`${TERRARIUM}/${ZOOM}/${x}/${y}.png`, { timeoutMs: 15_000, maxBytes: 2 * 1024 * 1024, accept: "image/png" });
  const png = res.status === 200 ? PNG.sync.read(res.body) : null;
  cache.set(key, png);
  return png;
}

/** Elevation at a global pixel position (handles neighbouring tiles). */
async function elevationAt(gx: number, gy: number): Promise<number | null> {
  const x = Math.floor(gx / 256);
  const y = Math.floor(gy / 256);
  const png = await tile(x, y);
  if (!png) return null;
  const px = Math.floor(gx - x * 256);
  const py = Math.floor(gy - y * 256);
  const i = (py * png.width + px) * 4;
  return terrariumElevation(png.data[i], png.data[i + 1], png.data[i + 2]);
}

/** Terrain slope (%) around a point, Horn's method on a 3×3 window; null when unavailable. */
export async function slopeAt(lat: number, lng: number): Promise<number | null> {
  try {
    const n = 2 ** ZOOM;
    const gx = ((lng + 180) / 360) * n * 256;
    const rad = (lat * Math.PI) / 180;
    const gy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n * 256;
    const window: number[] = [];
    for (const dy of [-STEP, 0, STEP]) {
      for (const dx of [-STEP, 0, STEP]) {
        const e = await elevationAt(gx + dx, gy + dy);
        if (e == null) return null;
        window.push(e);
      }
    }
    return hornSlopePercent(window, metersPerPixel(lat, ZOOM) * STEP);
  } catch {
    return null;
  }
}
