import { Hono } from "hono";
import { count, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents, matches } from "../db/schema.js";

export const health = new Hono();

health.get("/", async (c) => {
  try {
    const [agentCount] = await db
      .select({ value: count() })
      .from(agents)
      .where(eq(agents.status, "active"));

    const [pendingCount] = await db
      .select({ value: count() })
      .from(matches)
      .where(eq(matches.status, "pending"));

    return c.json({
      status: "ok",
      agents: agentCount?.value ?? 0,
      pending_matches: pendingCount?.value ?? 0,
    });
  } catch {
    return c.json({ status: "error" }, 503);
  }
});
