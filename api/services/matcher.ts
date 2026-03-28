import { eq, ne, and, or, notInArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents, matches } from "../db/schema.js";
import type { Persona } from "../types.js";

const SCENES = [
  "一家开在胡同里的独立书店，暖黄灯光，书架间弥漫着咖啡香",
  "深夜的路边拉面馆，雾气腾腾，只有吧台的几个座位",
  "周末下午的猫咖，三只橘猫在腿间穿梭",
  "二手黑胶唱片店，老式音箱放着 city pop",
  "天台上，星星不多但风刚好，旁边摆了两把折叠椅",
  "桌游吧的角落，桌上摊着一盘没下完的五子棋",
  "周末艺术展的出口处，墙上挂着一幅看不懂的画",
  "深夜拉面馆，只剩下最后两碗味增拉面",
  "城郊的徒步小径，树叶刚开始变黄",
  "周末跳蚤市场，有人在卖手工陶器和旧明信片",
];

export function interestOverlap(a: Persona, b: Persona): number {
  const setA = new Set((a.interests ?? []).map((s) => s.toLowerCase()));
  const setB = new Set((b.interests ?? []).map((s) => s.toLowerCase()));
  let overlap = 0;
  for (const item of setA) {
    if (setB.has(item)) overlap++;
  }
  const total = Math.max(setA.size, setB.size, 1);
  return (overlap / total) * 100;
}

export function pickScene(): string {
  return SCENES[Math.floor(Math.random() * SCENES.length)]!;
}

export async function findMatchForAgent(
  agentId: string,
): Promise<{ peer: typeof agents.$inferSelect; scene: string } | null> {
  // Get IDs this agent has already been matched with
  const pastMatches = await db
    .select({ aId: matches.agentAId, bId: matches.agentBId })
    .from(matches)
    .where(or(eq(matches.agentAId, agentId), eq(matches.agentBId, agentId)));

  const excludeIds = new Set<string>([agentId]);
  for (const m of pastMatches) {
    excludeIds.add(m.aId);
    excludeIds.add(m.bId);
  }

  const pool = await db
    .select()
    .from(agents)
    .where(eq(agents.status, "active"));

  const candidates = pool.filter((a) => !excludeIds.has(a.id));
  if (candidates.length === 0) return null;

  // Get the requesting agent's persona
  const [self] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);
  if (!self) return null;

  let selfPersona: Persona;
  try {
    selfPersona = JSON.parse(self.persona) as Persona;
  } catch {
    selfPersona = {};
  }

  // Score and pick best candidate
  const scored = candidates.map((c) => {
    let persona: Persona;
    try {
      persona = JSON.parse(c.persona) as Persona;
    } catch {
      persona = {};
    }
    return {
      agent: c,
      score: interestOverlap(selfPersona, persona) + Math.random() * 20,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;

  return { peer: best.agent, scene: pickScene() };
}

export async function runMatchScan(): Promise<number> {
  // Find active agents that don't have a pending/generating/ready match
  const activeAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.status, "active"));

  let created = 0;

  for (const agent of activeAgents) {
    // Check if agent already has an active (non-terminal) match
    const [activeMatch] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(
        and(
          or(eq(matches.agentAId, agent.id), eq(matches.agentBId, agent.id)),
          or(
            eq(matches.status, "pending"),
            eq(matches.status, "generating"),
            eq(matches.status, "ready"),
            eq(matches.status, "a_consent"),
            eq(matches.status, "b_consent"),
          ),
        ),
      )
      .limit(1);

    if (activeMatch) continue;

    const result = await findMatchForAgent(agent.id);
    if (!result) continue;

    // Check the peer doesn't already have an active match either
    const [peerActiveMatch] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(
        and(
          or(
            eq(matches.agentAId, result.peer.id),
            eq(matches.agentBId, result.peer.id),
          ),
          or(
            eq(matches.status, "pending"),
            eq(matches.status, "generating"),
            eq(matches.status, "ready"),
            eq(matches.status, "a_consent"),
            eq(matches.status, "b_consent"),
          ),
        ),
      )
      .limit(1);

    if (peerActiveMatch) continue;

    const matchId = crypto.randomUUID();
    const now = new Date();

    await db.insert(matches).values({
      id: matchId,
      agentAId: agent.id,
      agentBId: result.peer.id,
      status: "pending",
      scene: result.scene,
      createdAt: now,
      updatedAt: now,
    });

    created++;
  }

  return created;
}
