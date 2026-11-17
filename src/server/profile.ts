import "server-only";
import { cache } from "react";
import { parseProfile, type Profile } from "@/domain/profile";
import { getSettings } from "./settings";

/** Owner's decision profile (defaults when never saved). */
export const getProfile = cache(async (): Promise<Profile> => parseProfile((await getSettings()).profile));
