import { integer, pgTable, primaryKey, real, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { properties } from "./listings";

/**
 * Cached door-to-door trips from a property to one of the owner's workplaces, one row per
 * direction (ida at the departure time, volta at the return time). `signature` holds what the
 * trip depends on (both points, mode, time); a different signature means the row is stale.
 */
export const commuteTrips = pgTable(
  "commute_trips",
  {
    propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
    workplaceId: text("workplace_id").notNull(),
    /** ida | volta */
    direction: text("direction").notNull(),
    mode: text("mode").notNull(),
    signature: text("signature").notNull(),
    minutes: smallint("minutes").notNull(),
    minMinutes: smallint("min_minutes").notNull(),
    maxMinutes: smallint("max_minutes").notNull(),
    freeFlowMinutes: smallint("free_flow_minutes"),
    distanceKm: real("distance_km").notNull(),
    /** tomtom | modelo */
    method: text("method").notNull(),
    at: text("at").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.propertyId, t.workplaceId, t.direction] })],
);
