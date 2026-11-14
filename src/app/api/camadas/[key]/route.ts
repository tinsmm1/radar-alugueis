import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated } from "@/auth/session";
import { parseBbox } from "@/domain/geo";
import { logger } from "@/lib/logger";
import { isLayerKey, layerGeoJson } from "@/server/map-layers";

export const dynamic = "force-dynamic";

/** One map layer as GeoJSON (risk polygons, urban features, regionais, bairro points). */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/camadas/[key]">) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { key } = await ctx.params;
  if (!isLayerKey(key)) return NextResponse.json({ error: "camada desconhecida" }, { status: 404 });
  const raw = request.nextUrl.searchParams.get("bbox");
  const bbox = raw ? parseBbox(raw) : null;
  if (raw && !bbox) return NextResponse.json({ error: "bbox inválido" }, { status: 400 });
  try {
    const json = await layerGeoJson(key, bbox);
    return new NextResponse(json, { headers: { "Content-Type": "application/geo+json; charset=utf-8", "Cache-Control": "private, max-age=600" } });
  } catch (err) {
    logger.error({ key, msg: (err as Error).message }, "layer geojson failed");
    return NextResponse.json({ error: "falha ao carregar a camada" }, { status: 500 });
  }
}
