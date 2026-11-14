"use server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { savedSearches } from "@/db/schema";
import { filterFromParams, filterToParams } from "@/domain/filters";
import { ActionError, parse, runAction } from "./run-action";

const input = z.object({
  name: z.string().trim().min(1, "Dê um nome à busca.").max(80, "Nome longo demais (máximo de 80 caracteres)."),
  query: z.string().max(4000),
  notifyNew: z.boolean(),
  notifyDrop: z.boolean(),
  keepArea: z.boolean(),
});

/** Saves the current filter (normalized through the filter schema) as a search with notifications. */
export async function saveSearch(name: string, query: string, notifyNew: boolean, notifyDrop: boolean, keepArea = false) {
  return runAction(
    "saveSearch",
    async () => {
      const v = parse(input, { name, query, notifyNew, notifyDrop, keepArea });
      const filter = filterFromParams(new URLSearchParams(v.query));
      const clean = filterToParams(v.keepArea ? filter : { ...filter, bbox: undefined }).toString();
      const db = getDb();
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(savedSearches);
      if (count >= 50) throw new ActionError("Limite de 50 buscas salvas. Apague alguma em Buscas salvas.");
      const [row] = await db.insert(savedSearches).values({ name: v.name, query: clean, notifyNew: v.notifyNew, notifyDrop: v.notifyDrop }).returning({ id: savedSearches.id });
      return row;
    },
    "/buscas",
  );
}
