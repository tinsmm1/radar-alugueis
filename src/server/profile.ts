import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { parseProfile, type Profile } from "@/domain/profile";
import { ensureSeeded, getSettings } from "./settings";

/** Owner's decision profile for pages (cached per request; defaults when never saved). */
export const getProfile = cache(async (): Promise<Profile> => parseProfile((await getSettings()).profile));

/**
 * Fresh read for the pipeline (commutes, grades, alerts). Not cached: the recompute that runs in
 * `after()` shares the request that saved the profile, where the cached row is the old one.
 */
export async function loadProfile(): Promise<Profile> {
  await ensureSeeded();
  const [row] = await getDb().select({ profile: settings.profile }).from(settings).where(eq(settings.id, 1)).limit(1);
  return parseProfile(row?.profile);
}
