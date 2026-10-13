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

/**
 * A rate limit shared by every server instance (counted in the database),
 * for public endpoints that guess-and-check attacks target: sign-in, sign-up
 * and invite codes. The in-memory limiter above is per instance and resets
 * on cold start. If the database cannot be reached, the in-memory limit
 * still applies, so sign-in is never blocked by a counting failure.
 */
export async function rateLimitShared(identifier: string, options: Partial<RateLimitOptions> = {}): Promise<boolean> {
  const opts = { ...defaultOptions, ...options };
  const local = rateLimit(identifier, opts);
  if (!local.allowed) return false;
  try {
    const { createSupabaseAdmin } = await import('@/lib/supabase-admin');
    const { data, error } = await createSupabaseAdmin().rpc('hit_rate_limit', {
      p_key: identifier,
      p_max: opts.maxRequests,
      p_window_seconds: Math.ceil(opts.windowMs / 1000),
    });
    if (error) throw error;
    return data !== false;
  } catch (err) {
    console.error('[rate-limit] shared counter unavailable:', err);
    return true;
  }
}
