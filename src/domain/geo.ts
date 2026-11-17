/** Geometry helpers shared by server and client (no I/O). */

/** Belo Horizonte bounding box (lon/lat), a little wider than the municipal limit. */
export const BH_BBOX = { west: -44.07, south: -20.06, east: -43.85, north: -19.77 } as const;
export const BH_CENTER = { lng: -43.9386, lat: -19.9191 } as const;

export function insideBh(lat: number, lng: number): boolean {
  return lat >= BH_BBOX.south && lat <= BH_BBOX.north && lng >= BH_BBOX.west && lng <= BH_BBOX.east;
}

/** Great-circle distance in metres. */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Web-mercator tile containing a point. */
export function tileOf(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x, y };
}

/** Tile pixel (0..extent) → lon/lat. */
export function tilePixelToLngLat(z: number, x: number, y: number, px: number, py: number, extent: number): [number, number] {
  const n = 2 ** z;
  const lng = ((x + px / extent) / n) * 360 - 180;
  const yy = (y + py / extent) / n;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * yy))) * 180) / Math.PI;
  return [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6];
}

/** Every tile at zoom z covering a bbox. */
export function tilesFor(bbox: { west: number; south: number; east: number; north: number }, z: number): Array<{ x: number; y: number }> {
  const a = tileOf(bbox.west, bbox.north, z);
  const b = tileOf(bbox.east, bbox.south, z);
  const out: Array<{ x: number; y: number }> = [];
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) out.push({ x, y });
  return out;
}

/** Terrarium-encoded elevation (AWS open terrain tiles): metres from RGB. */
export function terrariumElevation(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** Ground size of one pixel (metres) of a 256 px tile at zoom z and latitude. */
export function metersPerPixel(lat: number, z: number, tileSize = 256): number {
  return (156_543.033_92 * Math.cos((lat * Math.PI) / 180)) / 2 ** z / (tileSize / 256);
}

/**
 * Slope (percent) from a 3×3 elevation window (row-major, metres) with Horn's method;
 * `cell` is the spacing between samples in metres.
 */
export function hornSlopePercent(w: number[], cell: number): number {
  const [a, b, c, d, , f, g, h, i] = w;
  const dzdx = (c + 2 * f + i - (a + 2 * d + g)) / (8 * cell);
  const dzdy = (g + 2 * h + i - (a + 2 * b + c)) / (8 * cell);
  return Math.round(Math.sqrt(dzdx * dzdx + dzdy * dzdy) * 1000) / 10;
}

/** Bbox string "w,s,e,n" (from the map) → object, clamped to valid ranges; null if malformed. */
export function parseBbox(value: string | null | undefined): { west: number; south: number; east: number; north: number } | null {
  const parts = (value ?? "").split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  if (west >= east || south >= north || Math.abs(south) > 90 || Math.abs(north) > 90 || Math.abs(west) > 180 || Math.abs(east) > 180) return null;
  return { west, south, east, north };
}

/** Box around the Belo Horizonte metropolitan area (Nova Lima, Contagem, Betim, Sabará...). */
export const RMBH_BBOX = { west: -44.4, south: -20.4, east: -43.5, north: -19.5 } as const;

/**
 * Typed coordinate → decimal degrees. Accepts "-19.9836", "-19,9836", "19°59'00.8\"S" and
 * "19 59 0.8 S". South and west make it negative. Anything unreadable → null.
 */
export function parseCoordinate(text: string): number | null {
  const t = text.trim().toUpperCase().replace(/[′’]/g, "'").replace(/[″”]/g, '"');
  if (!t) return null;
  const plain = Number(t.replace(",", "."));
  if (Number.isFinite(plain)) return plain;
  const m = /^(-)?\s*(\d+(?:[.,]\d+)?)\s*[°º ]\s*(?:(\d+(?:[.,]\d+)?)\s*['\s]\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:"|'')?\s*)?([NSEWLO])?$/.exec(t);
  if (!m) return null;
  const [, minus, d, mi, s, hemi] = m;
  const n = (v: string | undefined) => (v ? Number(v.replace(",", ".")) : 0);
  if (n(mi) >= 60 || n(s) >= 60) return null;
  const value = n(d) + n(mi) / 60 + n(s) / 3600;
  const negative = minus === "-" || hemi === "S" || hemi === "W" || hemi === "O";
  return Math.round((negative ? -value : value) * 1e6) / 1e6;
}

/** "lat, lng" pasted from Google Maps into one field → both values (decimal or degrees). */
export function parseCoordinatePair(text: string): { lat: number; lng: number } | null {
  const parts = text.split(/\s*[,;]\s*(?=[-\d])|\s{2,}|(?<=[NSEWLO])\s+/i).filter(Boolean);
  if (parts.length !== 2) return null;
  const lat = parseCoordinate(parts[0]!);
  const lng = parseCoordinate(parts[1]!);
  return lat != null && lng != null ? { lat, lng } : null;
}
