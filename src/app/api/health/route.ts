import { NextResponse } from "next/server";
import { databaseUp } from "@/server/health";

export const dynamic = "force-dynamic";

/** Public liveness check: app name and database reachability only (no data). */
export async function GET() {
  const database = await databaseUp();
  return NextResponse.json({ app: "radar-alugueis", database }, { status: database ? 200 : 503, headers: { "cache-control": "no-store" } });
}
