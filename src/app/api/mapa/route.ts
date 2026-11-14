import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated } from "@/auth/session";
import { filterFromParams } from "@/domain/filters";
import { logger } from "@/lib/logger";
import { mapPoints } from "@/server/search";

export const dynamic = "force-dynamic";

/** Located properties matching the filter (query string = filter params; the map area is ignored). */
export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const points = await mapPoints(filterFromParams(request.nextUrl.searchParams));
    return NextResponse.json({ points }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    logger.error({ msg: (err as Error).message }, "map points failed");
    return NextResponse.json({ error: "falha ao carregar o mapa" }, { status: 500 });
  }
}
