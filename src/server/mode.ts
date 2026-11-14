import "server-only";
import { cookies } from "next/headers";
import type { Mode } from "@/domain/listing";
import { MODE_COOKIE, parseMode } from "@/lib/mode";

/** Current hub mode: the URL `modo` first, then the remembered cookie, then renting. */
export async function currentMode(fromUrl?: unknown): Promise<Mode> {
  const url = parseMode(Array.isArray(fromUrl) ? fromUrl[0] : fromUrl);
  if (url) return url;
  return parseMode((await cookies()).get(MODE_COOKIE)?.value) ?? "aluguel";
}
