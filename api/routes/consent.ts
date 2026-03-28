import { Hono } from "hono";
import { eq, and, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { dateReports, matches, agents } from "../db/schema.js";
import { decrypt } from "../crypto.js";
import type { ConsentBody } from "../types.js";

export const consent = new Hono();

consent.post("/:report_id/consent", async (c) => {
  const reportId = c.req.param("report_id");

  let body: ConsentBody;
  try {
    body = await c.req.json<ConsentBody>();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!body.agent_id) {
    return c.json({ error: "Missing agent_id" }, 400);
  }

  const [report] = await db
    .select()
    .from(dateReports)
    .where(eq(dateReports.id, reportId))
    .limit(1);

  if (!report) {
    return c.json({ error: "Report not found" }, 404);
  }

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, report.matchId))
    .limit(1);

  if (!match) {
    return c.json({ error: "Match not found" }, 404);
  }

  // Verify agent is part of this match
  const isA = match.agentAId === body.agent_id;
  const isB = match.agentBId === body.agent_id;
  if (!isA && !isB) {
    return c.json({ error: "Agent is not part of this match" }, 403);
  }

  if (match.status === "exchanged") {
    return c.json({ error: "Contacts already exchanged" }, 409);
  }

  if (!body.consent) {
    await db
      .update(matches)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(matches.id, match.id));
    return c.json({ status: "declined", message: "已拒绝，匹配已关闭" });
  }

  // Determine new status
  let newStatus: string;
  if (match.status === "ready") {
    newStatus = isA ? "a_consent" : "b_consent";
  } else if (match.status === "a_consent" && isB) {
    newStatus = "exchanged";
  } else if (match.status === "b_consent" && isA) {
    newStatus = "exchanged";
  } else if (
    (match.status === "a_consent" && isA) ||
    (match.status === "b_consent" && isB)
  ) {
    return c.json({
      status: "waiting_for_other",
      message: "你已经同意过了，等待对方回应",
    });
  } else {
    return c.json({ error: "Match is not in a consentable state" }, 400);
  }

  await db
    .update(matches)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(matches.id, match.id));

  if (newStatus === "exchanged") {
    // Get the peer's contact info
    const peerId = isA ? match.agentBId : match.agentAId;
    const [peer] = await db
      .select({ contactType: agents.contactType, contactValue: agents.contactValue })
      .from(agents)
      .where(eq(agents.id, peerId))
      .limit(1);

    if (peer) {
      return c.json({
        status: "exchanged",
        peer_contact: {
          type: peer.contactType,
          value: decrypt(peer.contactValue),
        },
        message: "双方都同意了！这是对方的联系方式",
      });
    }
  }

  return c.json({
    status: "waiting_for_other",
    message: "已记录你的意愿，等待对方回应",
  });
});
