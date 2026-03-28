import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { matches, dateReports, agents } from "../db/schema.js";
import { generateDate } from "./dateGenerator.js";
import type { Persona } from "../types.js";

async function notifyAgent(callbackUrl: string, payload: unknown): Promise<void> {
  try {
    await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error(`Webhook failed for ${callbackUrl}:`, e instanceof Error ? e.message : e);
  }
}

export async function processPendingMatches(): Promise<number> {
  const pending = await db
    .select()
    .from(matches)
    .where(eq(matches.status, "pending"));

  let processed = 0;

  for (const match of pending) {
    // Mark as generating
    await db
      .update(matches)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(matches.id, match.id));

    // Create report placeholder
    const reportId = crypto.randomUUID();
    await db.insert(dateReports).values({
      id: reportId,
      matchId: match.id,
    });

    // Get both agents' personas
    const [agentA] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, match.agentAId))
      .limit(1);
    const [agentB] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, match.agentBId))
      .limit(1);

    if (!agentA || !agentB) {
      await db
        .update(dateReports)
        .set({ error: "Agent not found", generatedAt: new Date() })
        .where(eq(dateReports.id, reportId));
      await db
        .update(matches)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(matches.id, match.id));
      continue;
    }

    let personaA: Persona, personaB: Persona;
    try {
      personaA = JSON.parse(agentA.persona) as Persona;
    } catch {
      personaA = {};
    }
    try {
      personaB = JSON.parse(agentB.persona) as Persona;
    } catch {
      personaB = {};
    }

    const scene = match.scene ?? "一家安静的咖啡馆";

    console.log(`Generating date for match ${match.id}...`);
    const result = await generateDate(personaA, personaB, scene);

    const now = new Date();
    await db
      .update(dateReports)
      .set({
        story: result.story,
        summary: result.summary ? JSON.stringify(result.summary) : null,
        error: result.error ?? null,
        generatedAt: now,
      })
      .where(eq(dateReports.id, reportId));

    await db
      .update(matches)
      .set({ status: "ready", updatedAt: now })
      .where(eq(matches.id, match.id));

    console.log(
      `Match ${match.id} → report ${reportId} generated` +
        (result.error ? ` (with error: ${result.error})` : ""),
    );

    // Webhook notifications
    const callbackPayload = {
      event: "report_ready",
      match_id: match.id,
      report_id: reportId,
    };

    if (agentA.callbackUrl) {
      await notifyAgent(agentA.callbackUrl, {
        ...callbackPayload,
        agent_id: agentA.id,
      });
    }
    if (agentB.callbackUrl) {
      await notifyAgent(agentB.callbackUrl, {
        ...callbackPayload,
        agent_id: agentB.id,
      });
    }

    processed++;
  }

  return processed;
}
