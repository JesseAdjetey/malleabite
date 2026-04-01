import { NextRequest, NextResponse } from 'next/server';

// In-memory rate limit store (per-instance, resets on cold start — sufficient for edge abuse prevention)
// For stricter limits use Upstash Redis: https://upstash.com
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/send-email':   { max: 10,  windowMs: 60_000 },   // 10 emails/min per IP
  '/api/slack-notify': { max: 20,  windowMs: 60_000 },   // 20 Slack msgs/min per IP
  '/api/feedback':     { max: 5,   windowMs: 60_000 },   // 5 feedbacks/min per IP
  '/api/':             { max: 100, windowMs: 60_000 },   // 100 req/min fallback
};

function getLimit(pathname: string) {
  for (const [prefix, limit] of Object.entries(LIMITS)) {
    if (pathname.startsWith(prefix) && prefix !== '/api/') return limit;
  }
  return LIMITS['/api/'];
}

function getRateLimitKey(ip: string, pathname: string): string {
  return `${ip}:${pathname}`;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next();

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const { max, windowMs } = getLimit(pathname);
  const key = getRateLimitKey(ip, pathname);
  const now = Date.now();

  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return NextResponse.next();
  }

  entry.count += 1;

  if (entry.count > max) {
    return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
