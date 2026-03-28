import { Hono } from "hono";
import { eq, or, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents, matches, dateReports } from "../db/schema.js";

export const status = new Hono();

status.get("/:agent_id", async (c) => {
  const agentId = c.req.param("agent_id");

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  // Find the latest match involving this agent
  const [latestMatch] = await db
    .select()
    .from(matches)
    .where(or(eq(matches.agentAId, agentId), eq(matches.agentBId, agentId)))
    .orderBy(desc(matches.createdAt))
    .limit(1);

  if (!latestMatch) {
    return c.json({ agent_id: agentId, status: "waiting" });
  }

  if (
    latestMatch.status === "ready" ||
    latestMatch.status === "a_consent" ||
    latestMatch.status === "b_consent"
  ) {
    const [report] = await db
      .select({ id: dateReports.id })
      .from(dateReports)
      .where(eq(dateReports.matchId, latestMatch.id))
      .limit(1);

    return c.json({
      agent_id: agentId,
      status: "report_ready",
      match_id: latestMatch.id,
      report_id: report?.id ?? null,
    });
  }

  if (latestMatch.status === "exchanged") {
    const [report] = await db
      .select({ id: dateReports.id })
      .from(dateReports)
      .where(eq(dateReports.matchId, latestMatch.id))
      .limit(1);

    return c.json({
      agent_id: agentId,
      status: "exchanged",
      match_id: latestMatch.id,
      report_id: report?.id ?? null,
    });
  }

  if (
    latestMatch.status === "pending" ||
    latestMatch.status === "generating"
  ) {
    return c.json({
      agent_id: agentId,
      status: "matched",
      match_id: latestMatch.id,
    });
  }

  return c.json({ agent_id: agentId, status: "waiting" });
});
