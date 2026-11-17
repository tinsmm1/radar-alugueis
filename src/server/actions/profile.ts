"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { insideBh } from "@/domain/geo";
import { newWorkplaceId, parseProfile, profileSchema, workplaceSchema, type Workplace } from "@/domain/profile";
import { refreshOpportunities } from "../collect/opportunities";
import { pruneTrips, refreshCommutes } from "../commute/refresh";
import { geocodePlace } from "../geo/geocode";
import { BUSY, withRunLock } from "../run-lock";
import { getSettings } from "../settings";
import { ActionError, parse, runAction } from "./run-action";

/** Form input: like the stored profile, but a new workplace has no id yet. */
const inputSchema = profileSchema.extend({
  workplaces: z.array(workplaceSchema.extend({ id: z.string().regex(/^[a-z0-9-]{3,40}$/).optional() })).max(4, "Cadastre até 4 locais."),
});

/** Near Belo Horizonte (metropolitan area): a generous box around the city. */
const nearBh = (lat: number, lng: number) => insideBh(lat, lng) || (lat > -20.4 && lat < -19.5 && lng > -44.4 && lng < -43.5);

/**
 * Saves the decision profile. Workplaces whose address changed (or that have no coordinates)
 * are geocoded; the owner may also type coordinates. Cached trips of removed workplaces are
 * dropped; the next run (or "Recalcular agora") recomputes commutes and grades.
 */
export async function saveProfile(input: z.input<typeof inputSchema>) {
  return runAction("saveProfile", async () => {
    const v = parse(inputSchema, input);
    const old = parseProfile((await getSettings()).profile);
    const byId = new Map(old.workplaces.map((w) => [w.id, w]));
    const workplaces: Workplace[] = [];
    for (const w of v.workplaces) {
      const prev = w.id ? byId.get(w.id) : undefined;
      let { lat, lng } = w;
      const typed = lat != null && lng != null && (!prev || prev.lat !== lat || prev.lng !== lng);
      if (!typed && (lat == null || lng == null || !prev || prev.address !== w.address)) {
        const hit = await geocodePlace(w.address);
        if (!hit) throw new ActionError(`Não encontrei o endereço de "${w.name}". Escreva rua, número e bairro, ou informe as coordenadas.`);
        ({ lat, lng } = hit);
      }
      if (lat == null || lng == null || !nearBh(lat, lng)) throw new ActionError(`"${w.name}" ficou fora da região de Belo Horizonte. Confira o endereço ou as coordenadas.`);
      workplaces.push({ ...w, id: w.id ?? newWorkplaceId(w.name), lat, lng });
    }
    const profile = profileSchema.parse({ ...v, workplaces });
    await getDb().update(settings).set({ profile, updatedAt: new Date() }).where(eq(settings.id, 1));
    await pruneTrips(workplaces.map((w) => w.id));
    return { workplaces: workplaces.map((w) => ({ id: w.id, lat: w.lat, lng: w.lng })) };
  }, "/");
}

/** Recomputes commutes (up to ~45 s) and then every grade with the new profile. */
export async function recalcProfileNow() {
  return runAction("recalcProfileNow", async () => {
    const deadline = Date.now() + 45_000;
    const result = await withRunLock("collect", async () => {
      const c = await refreshCommutes(deadline);
      const o = await refreshOpportunities();
      return { commutes: c.updated, remaining: c.remaining, graded: o.withSignals };
    });
    if (result === BUSY) throw new ActionError("Uma coleta está em andamento. Tente de novo em alguns minutos.");
    return result;
  }, "/");
}
