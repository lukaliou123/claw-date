import type { MiddlewareHandler } from "hono";

const windowMs = 60_000;
const maxRequests = 60;
const store = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store) {
    if (val.resetAt <= now) store.delete(key);
  }
}, 5 * 60_000);

export const rateLimit: MiddlewareHandler = async (c, next) => {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  let entry = store.get(ip);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(ip, entry);
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return c.json({ error: "Too many requests" }, 429);
  }

  await next();
};
