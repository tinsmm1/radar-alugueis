/** Listing availability across collection runs. */
export type ListingStatus = "ativo" | "possivelmente_indisponivel" | "indisponivel";

export const STATUS_LABEL: Record<ListingStatus, string> = {
  ativo: "Disponível",
  possivelmente_indisponivel: "Possivelmente indisponível",
  indisponivel: "Indisponível",
};

export type Known = { externalId: string; status: ListingStatus; missingCount: number; lastSeenAt: Date };

export type Transition = { externalId: string; status: ListingStatus; missingCount: number; event: "sumiu" | "indisponivel" | null };

/** Missing in this many consecutive full runs AND unseen for this long → unavailable. */
export const MISSES_TO_UNAVAILABLE = 2;
export const HOURS_TO_UNAVAILABLE = 36;

/**
 * Disappearing listings are not deleted: the first miss makes them "possivelmente
 * indisponível"; they become "indisponível" only after MISSES_TO_UNAVAILABLE consecutive
 * misses spanning HOURS_TO_UNAVAILABLE. Sources that send partial data (uploads of a few
 * listings, manual entries) never mark misses. A snapshot that lost more than half of the active
 * listings is treated as partial too: a truncated feed must not "sell" everything.
 */
export function reconcileMissing(known: Known[], seen: Set<string>, now: Date, fullSnapshot: boolean): { transitions: Transition[]; partial: boolean } {
  if (!fullSnapshot) return { transitions: [], partial: false };
  const active = known.filter((k) => k.status !== "indisponivel");
  const stillThere = active.filter((k) => seen.has(k.externalId)).length;
  if (active.length >= 20 && stillThere < active.length * 0.5) return { transitions: [], partial: true };
  const transitions: Transition[] = [];
  for (const k of active) {
    if (seen.has(k.externalId)) continue;
    const missingCount = k.missingCount + 1;
    const longEnough = now.getTime() - k.lastSeenAt.getTime() >= HOURS_TO_UNAVAILABLE * 3_600_000;
    if (missingCount >= MISSES_TO_UNAVAILABLE && longEnough) transitions.push({ externalId: k.externalId, status: "indisponivel", missingCount, event: "indisponivel" });
    else transitions.push({ externalId: k.externalId, status: "possivelmente_indisponivel", missingCount, event: k.status === "ativo" ? "sumiu" : null });
  }
  return { transitions, partial: false };
}

export type PricePoint = { rentCents: number | null; condoCents: number | null; iptuCents: number | null; salePriceCents?: number | null };

/** Did any price component change (a new value appearing counts; a value disappearing does not erase history)? */
export function priceChanged(before: PricePoint, after: PricePoint): boolean {
  return (["rentCents", "condoCents", "iptuCents", "salePriceCents"] as const).some((k) => after[k] != null && after[k] !== (before[k] ?? null));
}

/** Rent drop in basis points (positive = cheaper); null when not a drop. */
export function dropBp(previous: number | null, current: number | null): number | null {
  if (previous == null || current == null || current >= previous) return null;
  return Math.round(((previous - current) / previous) * 10_000);
}
