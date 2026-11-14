"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { savedSearches } from "@/db/schema";
import { parse, runAction } from "./run-action";

const id = z.int().positive();

export async function renameSearch(searchId: number, name: string) {
  return runAction("renameSearch", async () => {
    const n = parse(z.string().trim().min(1, "Dê um nome à busca.").max(80, "Nome longo demais."), name);
    const db = getDb();
    await db.update(savedSearches).set({ name: n }).where(eq(savedSearches.id, parse(id, searchId)));
  }, "/buscas");
}

export async function setSearchNotify(searchId: number, field: "notifyNew" | "notifyDrop", value: boolean) {
  return runAction("setSearchNotify", async () => {
    const f = parse(z.enum(["notifyNew", "notifyDrop"]), field);
    const db = getDb();
    await db.update(savedSearches).set({ [f]: parse(z.boolean(), value) }).where(eq(savedSearches.id, parse(id, searchId)));
  }, "/buscas");
}

export async function deleteSearch(searchId: number) {
  return runAction("deleteSearch", async () => {
    const db = getDb();
    await db.delete(savedSearches).where(eq(savedSearches.id, parse(id, searchId)));
  }, "/buscas");
}
