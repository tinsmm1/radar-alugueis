import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/auth/session";
import { logger } from "@/lib/logger";
import { geocodePlace } from "@/server/geo/geocode";
import { clientKey, hit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const query = z.string().trim().min(3).max(120);

/** Address or place in Belo Horizonte → coordinates (reference point of the distance filter). */
export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = query.safeParse(request.nextUrl.searchParams.get("q"));
  if (!q.success) return NextResponse.json({ error: "Digite pelo menos 3 letras." }, { status: 400 });
  // The geocoder allows 1 request per second for everyone: keep the owner well below that.
  if (!(await hit(await clientKey("geocode"), 20, 60))) return NextResponse.json({ error: "Muitas buscas seguidas. Aguarde um minuto." }, { status: 429 });
  try {
    const place = await geocodePlace(q.data);
    if (!place) return NextResponse.json({ error: "Endereço não encontrado em Belo Horizonte." }, { status: 404 });
    return NextResponse.json(place, { headers: { "Cache-Control": "private, max-age=86400" } });
  } catch (err) {
    logger.warn({ msg: (err as Error).message }, "geocode failed");
    return NextResponse.json({ error: "Serviço de endereços indisponível agora." }, { status: 503 });
  }
}
