/**
 * Simple in-process rate limiter for Next.js API routes.
 *
 * Uses a sliding window algorithm backed by a Map.
 * For multi-instance deployments, replace with Redis (ioredis).
 *
 * Usage in an API route:
 *   import { rateLimit } from "@/lib/rate-limit";
 *   const allowed = await rateLimit(req, { max: 30, windowMs: 60_000 });
 *   if (!allowed) return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
 */

type Options = {
  max: number;       // max requests per window
  windowMs: number;  // window size in milliseconds
  key?: string;      // optional static key override
};

type Entry = {
  count:     number;
  resetAt:   number;
};

const store = new Map<string, Entry>();

// Cleanup entries older than 5 minutes every minute
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store.entries()) {
      if (v.resetAt < now - 300_000) store.delete(k);
    }
  }, 60_000).unref?.();
}

export function rateLimit(
  ip: string,
  opts: Options
): { allowed: boolean; remaining: number; resetAt: number } {
  const key     = opts.key ?? ip;
  const now     = Date.now();
  const entry   = store.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: opts.max - 1, resetAt };
  }

  entry.count++;
  store.set(key, entry);

  const allowed   = entry.count <= opts.max;
  const remaining = Math.max(0, opts.max - entry.count);
  return { allowed, remaining, resetAt: entry.resetAt };
}

/** Extracts real IP from Next.js request headers */
export function getIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
