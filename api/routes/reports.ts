import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { dateReports, matches } from "../db/schema.js";

export const reports = new Hono();

reports.get("/:report_id", async (c) => {
  const reportId = c.req.param("report_id");

  const [report] = await db
    .select()
    .from(dateReports)
    .where(eq(dateReports.id, reportId))
    .limit(1);

  if (!report) {
    return c.json({ error: "Report not found" }, 404);
  }

  const [match] = await db
    .select({ status: matches.status })
    .from(matches)
    .where(eq(matches.id, report.matchId))
    .limit(1);

  if (match?.status === "generating" || !report.story) {
    return c.json({
      report_id: report.id,
      status: "generating",
      message: "约会故事正在生成中，请稍后再查",
    }, 202);
  }

  let summary = null;
  if (report.summary) {
    try {
      summary = JSON.parse(report.summary);
    } catch {
      summary = null;
    }
  }

  return c.json({
    report_id: report.id,
    match_id: report.matchId,
    story: report.story,
    summary,
    generated_at: report.generatedAt?.toISOString() ?? null,
  });
});
