import { z } from "zod";

/**
 * Owner's decision profile (Administração → Perfil e trabalho): where the household works or
 * studies, at what times it leaves and comes back, how it travels, what an hour of commuting is
 * worth, the household finances for a purchase and how much each criterion weighs in the grade.
 * Stored as JSON in settings.profile; every field has a default so an empty row still parses.
 */
export const COMMUTE_MODES = ["carro", "onibus", "bicicleta", "a_pe"] as const;
export type CommuteMode = (typeof COMMUTE_MODES)[number];
export const COMMUTE_MODE_LABEL: Record<CommuteMode, string> = { carro: "Carro", onibus: "Ônibus / metrô", bicicleta: "Bicicleta", a_pe: "A pé" };

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM.");

export const workplaceSchema = z.object({
  /** Stable id (slug + random suffix), kept across edits so cached trips stay valid. */
  id: z.string().regex(/^[a-z0-9-]{3,40}$/),
  name: z.string().trim().min(2, "Dê um nome ao local (ex.: Trabalho da Ana).").max(60),
  address: z.string().trim().min(3, "Informe o endereço do local.").max(160),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  mode: z.enum(COMMUTE_MODES).default("carro"),
  /** Time leaving home (ida) and leaving work (volta), America/Sao_Paulo. */
  departure: hhmm.default("08:00"),
  returnAt: hhmm.default("18:00"),
  /** ISO weekdays (1 = Monday … 7 = Sunday) with this trip. */
  days: z.array(z.int().min(1).max(7)).min(1, "Escolha ao menos um dia.").max(7).default([1, 2, 3, 4, 5]),
  /** Relative importance among workplaces (two people, one goes 5×/week, the other 2×...). */
  weight: z.int().min(1).max(10).default(5),
});
export type Workplace = z.infer<typeof workplaceSchema>;

export const WEIGHT_KEYS = ["preco", "custos", "deslocamento", "servicos", "imovel"] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];
export const WEIGHT_LABEL: Record<WeightKey, string> = {
  preco: "Preço frente a parecidos",
  custos: "Custos claros (aluguel) ou rendimento (compra)",
  deslocamento: "Tempo até o trabalho",
  servicos: "Serviços e transporte por perto",
  imovel: "Imóvel e qualidade dos dados",
};

export const profileSchema = z.object({
  workplaces: z.array(workplaceSchema).max(4).default([]),
  /** Above this door-to-door time (minutes, one way) a trip is a point of attention. */
  maxCommuteMin: z.int().min(10).max(180).default(45),
  /** Value of one hour spent commuting (R$ in cents) — 0 to ignore time in the cost. */
  hourValueCents: z.int().min(0).max(100_000).default(2500),
  /** Car: fuel + wear per km (cents) and parking per day at work (cents). */
  carCostPerKmCents: z.int().min(0).max(1000).default(85),
  parkingPerDayCents: z.int().min(0).max(20_000).default(0),
  /** Public transport fare per boarding (BH 2026: R$ 6,25 bus, R$ 6,00 metro). */
  transitFareCents: z.int().min(0).max(5000).default(625),
  /** Buyer finances (all optional; used by the affordability analysis). */
  monthlyIncomeCents: z.int().min(0).max(100_000_000).nullable().default(null),
  savingsCents: z.int().min(0).max(10_000_000_000).nullable().default(null),
  /** Share of income a bank usually accepts for the installment (Brazil: ~30%). */
  maxInstallmentPct: z.number().min(10).max(50).default(30),
  /** Notify new offers that fit the profile (grade, commute limit, budget) once per property and mode. */
  alerts: z.boolean().default(true),
  alertGrade: z.enum(["A", "B"]).default("B"),
  /** Set when the profile is saved: commutes older than this are recomputed. */
  updatedAt: z.string().max(40).nullable().default(null),
  /** Weights of the grade (they are normalised to 100). */
  weights: z.object({
    preco: z.int().min(0).max(100).default(40),
    custos: z.int().min(0).max(100).default(12),
    deslocamento: z.int().min(0).max(100).default(20),
    servicos: z.int().min(0).max(100).default(18),
    imovel: z.int().min(0).max(100).default(10),
  }).default({ preco: 40, custos: 12, deslocamento: 20, servicos: 18, imovel: 10 }),
});
export type Profile = z.infer<typeof profileSchema>;
export const DEFAULT_PROFILE: Profile = profileSchema.parse({});

/** Stored JSON → profile; anything invalid falls back to the defaults instead of breaking pages. */
export function parseProfile(raw: unknown): Profile {
  const r = profileSchema.safeParse(raw ?? {});
  if (r.success) return r.data;
  const partial = profileSchema.safeParse({ ...(typeof raw === "object" && raw ? raw : {}), workplaces: [] });
  return partial.success ? partial.data : DEFAULT_PROFILE;
}

/** Highest monthly rent total the household targets (income × max share), or null without income. */
export const rentBudgetCents = (p: Profile) => (p.monthlyIncomeCents ? Math.round((p.monthlyIncomeCents * p.maxInstallmentPct) / 100) : null);

/** Workplaces that can be routed (geocoded). */
export const locatedWorkplaces = (p: Profile) => p.workplaces.filter((w): w is Workplace & { lat: number; lng: number } => w.lat != null && w.lng != null);

/** Weights normalised to sum 100; without workplaces the commute weight is redistributed. */
export function normalisedWeights(p: Profile, hasCommute: boolean): Record<WeightKey, number> {
  const w = { ...p.weights, deslocamento: hasCommute ? p.weights.deslocamento : 0 };
  const sum = WEIGHT_KEYS.reduce((s, k) => s + w[k], 0);
  if (sum <= 0) return { preco: 50, custos: 15, deslocamento: 0, servicos: 25, imovel: 10 };
  return Object.fromEntries(WEIGHT_KEYS.map((k) => [k, (w[k] * 100) / sum])) as Record<WeightKey, number>;
}

/** Signature of what changes a trip (place, mode, times): cached trips with another one are stale. */
export function workplaceSignature(w: Workplace): string {
  return [w.lat?.toFixed(5), w.lng?.toFixed(5), w.mode, w.departure, w.returnAt].join("|");
}

export function newWorkplaceId(name: string, rand = Math.random()): string {
  const slug = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "local";
  return `${slug}-${Math.floor(rand * 1e6).toString(36).padStart(4, "0")}`;
}
