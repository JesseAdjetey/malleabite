// Simple in-memory rate limiter for Vercel serverless functions.
// Each function instance has its own counter — resets on cold start.
// Good enough to stop bot abuse; for stricter limits use Upstash Redis.

const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  ip: string,
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; retryAfter?: number } {
  const storeKey = `${key}:${ip}`;
  const now = Date.now();
  const entry = store.get(storeKey);

  if (!entry || now > entry.resetAt) {
    store.set(storeKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  entry.count += 1;

  if (entry.count > max) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { allowed: true };
}

export function getIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0].trim();
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return 'unknown';
}
