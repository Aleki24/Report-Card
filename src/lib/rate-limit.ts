// Simple in-memory rate limiter for API routes.
// For production with multiple instances, use Upstash Ratelimit or similar.

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

const defaultOptions: RateLimitOptions = {
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minute
};

export function rateLimit(
  identifier: string,
  options: Partial<RateLimitOptions> = {}
): { allowed: boolean; remaining: number; resetAt: number } {
  const opts = { ...defaultOptions, ...options };
  const now = Date.now();
  const key = `${identifier}`;

  const entry = requestCounts.get(key);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.maxRequests - 1, resetAt: now + opts.windowMs };
  }

  if (entry.count >= opts.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: opts.maxRequests - entry.count, resetAt: entry.resetAt };
}

// Periodic cleanup to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of requestCounts.entries()) {
      if (now > entry.resetAt) {
        requestCounts.delete(key);
      }
    }
  }, 60_000);
}
