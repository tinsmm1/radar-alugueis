"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { priceWatches, properties } from "@/db/schema";
import { checkPriceTargets } from "../notify/events";
import { ActionError, parse, runAction } from "./run-action";

const input = z.object({
  propertyId: z.int().positive(),
  mode: z.enum(["aluguel", "compra"]),
  /** Target in reais (null = follow every drop without a target). */
  target: z.int().min(1, "Informe um valor maior que zero.").max(100_000_000, "Valor alto demais.").nullable(),
});

/**
 * Starts (or updates) the price follow-up of a property in one mode, recording the current price.
 * The target is checked right away and after every collection.
 */
export async function setPriceWatch(raw: z.input<typeof input>) {
  return runAction("setPriceWatch", async () => {
    const w = parse(input, raw);
    const db = getDb();
    const [p] = await db.select({ forRent: properties.forRent, forSale: properties.forSale, total: properties.totalCents, rent: properties.rentCents, sale: properties.salePriceCents }).from(properties).where(eq(properties.id, w.propertyId));
    if (!p) throw new ActionError("Imóvel não encontrado.");
    if (w.mode === "compra" ? !p.forSale : !p.forRent) throw new ActionError(w.mode === "compra" ? "Este imóvel não está à venda." : "Este imóvel não está para alugar.");
    const current = w.mode === "compra" ? p.sale : (p.total ?? p.rent);
    const targetCents = w.target == null ? null : w.target * 100;
    await db
      .insert(priceWatches)
      .values({ propertyId: w.propertyId, mode: w.mode, targetCents, startPriceCents: current })
      // A new target re-arms the alert; the starting price stays the first one.
      .onConflictDoUpdate({ target: [priceWatches.propertyId, priceWatches.mode], set: { targetCents, notifiedPriceCents: null, notifiedAt: null } });
    await checkPriceTargets();
    return { reached: targetCents != null && current != null && current <= targetCents };
  });
}

export async function removePriceWatch(propertyId: number, mode: "aluguel" | "compra") {
  return runAction("removePriceWatch", async () => {
    const pid = parse(z.int().positive(), propertyId);
    const m = parse(z.enum(["aluguel", "compra"]), mode);
    await getDb().delete(priceWatches).where(and(eq(priceWatches.propertyId, pid), eq(priceWatches.mode, m)));
  });
}
