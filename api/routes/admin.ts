import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { runMatchScan } from "../services/matcher.js";
import { processPendingMatches } from "../services/queue.js";

const adminAuth: MiddlewareHandler = async (c, next) => {
  const key = process.env["ADMIN_API_KEY"];
  if (!key) {
    return c.json({ error: "Admin API is disabled (no ADMIN_API_KEY set)" }, 403);
  }
  const provided = c.req.header("x-admin-key") ?? c.req.query("key");
  if (provided !== key) {
    return c.json({ error: "Invalid admin key" }, 401);
  }
  await next();
};

export const admin = new Hono();
admin.use("*", adminAuth);

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
