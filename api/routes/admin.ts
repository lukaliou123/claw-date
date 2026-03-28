import { Hono } from "hono";
import { runMatchScan } from "../services/matcher.js";
import { processPendingMatches } from "../services/queue.js";

export const admin = new Hono();

admin.post("/trigger-match", async (c) => {
  const created = await runMatchScan();
  return c.json({ matched: created });
});

admin.post("/trigger-generate", async (c) => {
  const processed = await processPendingMatches();
  return c.json({ generated: processed });
});

admin.post("/trigger-all", async (c) => {
  const created = await runMatchScan();
  const processed = await processPendingMatches();
  return c.json({ matched: created, generated: processed });
});
