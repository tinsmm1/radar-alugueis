"use server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { favoriteLists, favorites } from "@/db/schema";
import { ActionError, parse, runAction } from "./run-action";

const id = z.int().positive();

async function defaultList(): Promise<number> {
  const [l] = await getDb().select({ id: favoriteLists.id }).from(favoriteLists).orderBy(favoriteLists.id).limit(1);
  return l!.id;
}

/** Adds to (or removes from) a list; without a list, the default "Favoritos". Returns the new state. */
export async function toggleFavorite(propertyId: number, listId?: number) {
  return runAction("toggleFavorite", async () => {
    const pid = parse(id, propertyId);
    const lid = listId == null ? await defaultList() : parse(id, listId);
    const db = getDb();
    const removed = await db.delete(favorites).where(and(eq(favorites.listId, lid), eq(favorites.propertyId, pid))).returning();
    if (removed.length) return { favorite: false };
    await db.insert(favorites).values({ listId: lid, propertyId: pid }).onConflictDoNothing();
    return { favorite: true };
  });
}

export async function saveFavoriteNote(propertyId: number, listId: number, note: string) {
  return runAction("saveFavoriteNote", async () => {
    const n = parse(z.string().max(2000, "Nota longa demais (máximo de 2.000 caracteres)."), note).trim();
    const db = getDb();
    await db.update(favorites).set({ note: n || null }).where(and(eq(favorites.listId, parse(id, listId)), eq(favorites.propertyId, parse(id, propertyId))));
  });
}

export async function createList(name: string) {
  return runAction("createList", async () => {
    const n = parse(z.string().trim().min(1, "Dê um nome à lista.").max(60, "Nome longo demais."), name);
    const [{ count }] = await getDb().select({ count: sql<number>`count(*)::int` }).from(favoriteLists);
    if (count >= 30) throw new ActionError("Limite de 30 listas.");
    const [row] = await getDb().insert(favoriteLists).values({ name: n }).returning({ id: favoriteLists.id });
    return row;
  });
}

export async function renameList(listId: number, name: string) {
  return runAction("renameList", async () => {
    const n = parse(z.string().trim().min(1, "Dê um nome à lista.").max(60, "Nome longo demais."), name);
    const db = getDb();
    await db.update(favoriteLists).set({ name: n }).where(eq(favoriteLists.id, parse(id, listId)));
  });
}

/** Deletes a list (its items go with it); the first list cannot be deleted. */
export async function deleteList(listId: number) {
  return runAction("deleteList", async () => {
    const lid = parse(id, listId);
    if (lid === (await defaultList())) throw new ActionError("A lista principal não pode ser apagada.");
    const db = getDb();
    await db.delete(favoriteLists).where(eq(favoriteLists.id, lid));
  });
}
