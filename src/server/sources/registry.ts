import "server-only";
import { parseApifyItems } from "@/domain/apify";
import { ApifySkip, fetchApifyItems, startDailyApifyRun } from "./apify-client";
import { keepListing } from "@/domain/collect-filters";
import { bairroRegionals, getCollectFilters } from "../collect-filters";
import { parseVrsync } from "@/domain/vrsync";
import type { NormalizedListing } from "@/domain/listing";
import { getDb } from "@/db";
import { sources } from "@/db/schema";
import { decodeText, safeFetch } from "../http";
import { PORTALS } from "./assessments";

export type SourceRow = typeof sources.$inferSelect;

/** What one collection of a source returns. */
export type Collected = {
  listings: NormalizedListing[];
  raws: Record<string, unknown>;
  skipped: Record<string, number>;
  /** True when the source sends its whole catalogue (missing listings may be unavailable). */
  fullSnapshot: boolean;
  /** Informational note shown with the run (e.g. the automatic Apify caps). */
  note?: string;
};

/** The source cannot run (pending integration, missing configuration): not a failure. */
export class SkipSource extends Error {}

export type Adapter = {
  /** Collected by the scheduler (feeds); uploads and manual entries arrive through actions. */
  scheduled: boolean;
  label: string;
  collect?: (source: SourceRow) => Promise<Collected>;
};

const FEED_MAX_BYTES = 25 * 1024 * 1024;
export const ADAPTERS: Record<string, Adapter> = {
  vrsync: {
    scheduled: true,
    label: "Feed VRSync autorizado",
    async collect(source) {
      if (!source.url) throw new SkipSource("Feed sem endereço configurado.");
      const res = await safeFetch(source.url, { maxBytes: FEED_MAX_BYTES, timeoutMs: 40_000, accept: "application/xml,text/xml;q=0.9,*/*;q=0.5" });
      if (res.status === 401 || res.status === 403) throw new Error(`O servidor do feed recusou o acesso (HTTP ${res.status}). Confirme a autorização com a imobiliária.`);
      if (res.status !== 200) throw new Error(`O feed respondeu HTTP ${res.status}.`);
      const parsed = parseVrsync(decodeText(res.body, res.contentType));
      if (!parsed.ok) throw new Error(parsed.error);
      return { listings: parsed.listings, raws: parsed.raws, skipped: parsed.skipped, fullSnapshot: true };
    },
  },
  apify: {
    scheduled: true,
    label: "Portal via Apify (coleta automática)",
    async collect(source) {
      if (!source.url) throw new SkipSource("Fonte do Apify sem tarefa configurada.");
      let items: unknown[];
      try {
        items = await fetchApifyItems(source.url);
      } catch (err) {
        if (err instanceof ApifySkip) throw new SkipSource(err.message);
        throw err;
      }
      const parsed = parseApifyItems(items);
      // Same filters again on import (the regional only exists here: the robot cannot filter by it).
      const [filters, regionalOf] = await Promise.all([getCollectFilters(), bairroRegionals()]);
      const kept = parsed.listings.filter((l) => keepListing(l, filters, regionalOf));
      const dropped = parsed.listings.length - kept.length;
      if (dropped) parsed.skipped["fora dos filtros"] = (parsed.skipped["fora dos filtros"] ?? 0) + dropped;
      parsed.listings = kept;
      // Then today's run (caps worked out from the remaining free credit); read at the next collection.
      const note = await startDailyApifyRun(source.url);
      // Capped runs bring only the newest N results: a listing missing from one run is not unavailable.
      return { ...parsed, fullSnapshot: false, note };
    },
  },
  planilha: { scheduled: false, label: "Planilha CSV enviada pelo dono" },
  manual: { scheduled: false, label: "Cadastro manual" },
  demo: { scheduled: false, label: "Dados de demonstração" },
  portal: {
    scheduled: true,
    label: "Portal (integração pendente)",
    async collect(source) {
      throw new SkipSource(`Integração pendente: ${source.name} não oferece API ou feed autorizado e os termos não permitem coleta automática.`);
    },
  },
};

/** Built-in sources, created once (portal rows carry their assessment). */
export async function ensureSources(): Promise<void> {
  const db = getDb();
  await db
    .insert(sources)
    .values([
      { key: "planilha", adapter: "planilha", name: "Planilhas enviadas", status: "ativa" },
      { key: "manual", adapter: "manual", name: "Cadastro manual", status: "ativa" },
      ...PORTALS.map((p) => ({ key: p.key, adapter: "portal", name: p.name, status: "pendente", assessment: p.assessment, url: p.assessment.site })),
    ])
    .onConflictDoNothing({ target: sources.key });
}

/** "Imobiliária Exemplo" → "feed-imobiliaria-exemplo". */
export function feedKey(name: string, prefix = "feed"): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${prefix}-${slug || "sem-nome"}`;
}
