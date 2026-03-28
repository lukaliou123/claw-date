import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  persona: text("persona").notNull(), // JSON string
  contactType: text("contact_type").notNull(),
  contactValue: text("contact_value").notNull(), // AES-256-GCM encrypted
  callbackUrl: text("callback_url"),
  status: text("status").notNull().default("active"),
  registeredAt: integer("registered_at", { mode: "timestamp" }).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
});

export const matches = sqliteTable("matches", {
  id: text("id").primaryKey(),
  agentAId: text("agent_a_id").notNull(),
  agentBId: text("agent_b_id").notNull(),
  status: text("status").notNull().default("pending"),
  scene: text("scene"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const dateReports = sqliteTable("date_reports", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  story: text("story"),
  summary: text("summary"), // JSON string
  error: text("error"),
  generatedAt: integer("generated_at", { mode: "timestamp" }),
});

export type Agent = typeof agents.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type DateReport = typeof dateReports.$inferSelect;
