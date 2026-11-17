import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { properties } from "./listings";

/** Single row (id = 1): owner password, notification channels, preferences. */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  passwordHash: text("password_hash"),
  notifyEmail: text("notify_email"),
  telegramChatId: text("telegram_chat_id"),
  notificationsSeenAt: timestamp("notifications_seen_at", { withTimezone: true }),
  /** Filters sent to the Apify robots and checked on import (see src/domain/collect-filters.ts). */
  collectFilters: jsonb("collect_filters"),
  /** Decision profile: workplaces and times, commute costs, finances, grade weights (src/domain/profile.ts). */
  profile: jsonb("profile"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Custom favourite lists ("Favoritos" is created by default). */
export const favoriteLists = pgTable("favorite_lists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const favorites = pgTable(
  "favorites",
  {
    listId: integer("list_id").notNull().references(() => favoriteLists.id, { onDelete: "cascade" }),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.propertyId] }), index("favorites_property").on(t.propertyId)],
);

export const savedSearches = pgTable("saved_searches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /** URL query string of the filter (validated by filterFromParams on read). */
  query: text("query").notNull(),
  notifyNew: boolean("notify_new").notNull().default(true),
  notifyDrop: boolean("notify_drop").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Price follow-up of one property in one mode: the price when it started and an optional
 * target. The owner is notified once each time the price reaches the target (or below).
 */
export const priceWatches = pgTable(
  "price_watches",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    /** aluguel (known monthly total, or rent when the total is unknown) | compra (asking price). */
    mode: text("mode").notNull(),
    targetCents: bigint("target_cents", { mode: "number" }),
    startPriceCents: bigint("start_price_cents", { mode: "number" }),
    /** Price of the last target notification (re-notifies only if it falls further). */
    notifiedPriceCents: bigint("notified_price_cents", { mode: "number" }),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("price_watches_property_mode").on(t.propertyId, t.mode)],
);

/** Events for the owner: new match, price drop, unavailable, back, source failure. */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(), // novo | baixa_preco | preco_alvo | perfil | indisponivel | voltou | fonte_falhou
    propertyId: integer("property_id").references(() => properties.id, { onDelete: "cascade" }),
    savedSearchId: integer("saved_search_id").references(() => savedSearches.id, { onDelete: "cascade" }),
    /** Dedup key: one notification per kind/property/search/day. */
    dedupKey: text("dedup_key").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    telegramAt: timestamp("telegram_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("notifications_dedup").on(t.dedupKey), index("notifications_created").on(t.createdAt)],
);

/** Fixed-window counters for login attempts and API rate limiting. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});
