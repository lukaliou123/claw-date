import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { agents } from "../db/schema.js";
import { encrypt } from "../crypto.js";
import { rateLimit } from "../middleware/rateLimit.js";
import type { RegisterBody } from "../types.js";

const CONTACT_TYPES = new Set(["wechat", "qq", "email", "telegram"]);
const MAX_PERSONA_LENGTH = 10_000;

export const register = new Hono();

register.post("/", rateLimit, async (c) => {
  let body: RegisterBody;
  try {
    body = await c.req.json<RegisterBody>();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!body.agent_id || typeof body.agent_id !== "string") {
    return c.json({ error: "Missing or invalid agent_id" }, 400);
  }
  if (!body.persona || typeof body.persona !== "object") {
    return c.json({ error: "Missing or invalid persona" }, 400);
  }
  if (!body.contact?.type || !body.contact?.value) {
    return c.json({ error: "Missing contact info" }, 400);
  }
  if (!CONTACT_TYPES.has(body.contact.type)) {
    return c.json(
      { error: `Invalid contact type. Allowed: ${[...CONTACT_TYPES].join(", ")}` },
      400,
    );
  }

  const personaStr = JSON.stringify(body.persona);
  if (personaStr.length > MAX_PERSONA_LENGTH) {
    return c.json({ error: "Persona too large" }, 400);
  }

  const now = new Date();
  const existing = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.id, body.agent_id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(agents)
      .set({
        persona: personaStr,
        contactType: body.contact.type,
        contactValue: encrypt(body.contact.value),
        callbackUrl: body.callback_url ?? null,
        lastSeenAt: now,
        status: "active",
      })
      .where(eq(agents.id, body.agent_id));
  } else {
    await db.insert(agents).values({
      id: body.agent_id,
      persona: personaStr,
      contactType: body.contact.type,
      contactValue: encrypt(body.contact.value),
      callbackUrl: body.callback_url ?? null,
      status: "active",
      registeredAt: now,
      lastSeenAt: now,
    });
  }

  return c.json(
    {
      registered: true,
      agent_id: body.agent_id,
      message: "已加入匹配池，等待匹配中",
    },
    201,
  );
});
