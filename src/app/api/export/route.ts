import { NextResponse } from "next/server";
import { isAuthenticated } from "@/auth/session";
import { CSV_TEMPLATE } from "@/domain/csv";
import { logger } from "@/lib/logger";
import { exportJson, exportPropertiesCsv } from "@/server/export";

export const dynamic = "force-dynamic";

/** /api/export?tipo=json | imoveis | modelo — owner downloads (session required). */
export async function GET(request: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const kind = new URL(request.url).searchParams.get("tipo");
  const day = new Date().toISOString().slice(0, 10);
  try {
    if (kind === "json") {
      return new NextResponse(JSON.stringify(await exportJson(), null, 2), {
        headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="radar-alugueis-backup-${day}.json"`, "cache-control": "no-store" },
      });
    }
    if (kind === "imoveis") {
      return new NextResponse(await exportPropertiesCsv(), {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="radar-alugueis-imoveis-${day}.csv"`, "cache-control": "no-store" },
      });
    }
    if (kind === "modelo") {
      return new NextResponse(`﻿${CSV_TEMPLATE}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="modelo-anuncios.csv"' } });
    }
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  } catch (err) {
    logger.error({ msg: (err as Error).message }, "export failed");
    return NextResponse.json({ error: "falha na exportação" }, { status: 500 });
  }
}
