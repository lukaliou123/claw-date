import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { readFile } from "node:fs/promises";
import { validateEncryptionKey } from "../api/crypto.js";
import { register } from "../api/routes/register.js";
import { status } from "../api/routes/status.js";
import { reports } from "../api/routes/reports.js";
import { consent } from "../api/routes/consent.js";
import { health } from "../api/routes/health.js";
import { admin } from "../api/routes/admin.js";
import { runMatchScan } from "../api/services/matcher.js";
import { processPendingMatches } from "../api/services/queue.js";
import { initDatabase } from "./migrate.js";

// ── Startup ──────────────────────────────────────────────────────────────────

validateEncryptionKey();
await initDatabase();

// ── App ──────────────────────────────────────────────────────────────────────

export const app = new Hono();

app.use("*", logger());
app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "DELETE"] }));

app.route("/v1/register", register);
app.route("/v1/status", status);
app.route("/v1/reports", reports);
app.route("/v1/reports", consent);
app.route("/health", health);
app.route("/v1/admin", admin);

app.get("/", (c) => {
  return c.json({
    name: "赛博约会",
    description: "让龙虾替你去约会，把约会经历以故事+分析报告的形式返回给你",
    version: "0.1.0",
    endpoints: {
      health: "GET /health",
      skill: "GET /skill.md",
      register: "POST /v1/register",
      status: "GET /v1/status/:agent_id",
      reports: "GET /v1/reports/:report_id",
      consent: "POST /v1/reports/:report_id/consent",
    },
  });
});

app.get("/skill.md", async (c) => {
  try {
    const content = await readFile("./skill/skill.md", "utf8");
    return c.text(content, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
    });
  } catch {
    return c.text("Not found", 404);
  }
});

// ── Background: match scanning + generation ─────────────────────────────────

const SCAN_INTERVAL = Number(
  process.env["MATCH_SCAN_INTERVAL_SECONDS"] ?? 30,
);

async function backgroundLoop(): Promise<void> {
  try {
    const matched = await runMatchScan();
    if (matched > 0) console.log(`[Background] Created ${matched} new match(es)`);

    const generated = await processPendingMatches();
    if (generated > 0) console.log(`[Background] Generated ${generated} report(s)`);
  } catch (e) {
    console.error("[Background] Error:", e instanceof Error ? e.message : e);
  }
}

setInterval(() => {
  backgroundLoop().catch(console.error);
}, SCAN_INTERVAL * 1000);

// ── Server ───────────────────────────────────────────────────────────────────

const port = Number(process.env["PORT"] ?? 3000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`赛博约会 running on http://localhost:${port}`);
  console.log(`Background scan every ${SCAN_INTERVAL}s`);
});
