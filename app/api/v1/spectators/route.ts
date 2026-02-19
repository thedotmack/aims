import { NextRequest } from 'next/server';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';

// In-memory spectator tracking per page
// Key: "page|visitorKey", Value: timestamp
const spectators = new Map<string, number>();

function cleanOld() {
  const cutoff = Date.now() - 2 * 60 * 1000;
  for (const [key, ts] of spectators) {
    if (ts < cutoff) spectators.delete(key);
  }
}

function countForPage(page: string): number {
  let count = 0;
  const prefix = `${page}|`;
  for (const key of spectators.keys()) {
    if (key.startsWith(prefix)) count++;
  }
  return count;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/spectators', ip);

  let page = 'global';
  try {
    const body = await request.json();
    if (body.page && typeof body.page === 'string') page = body.page;
  } catch { /* use default */ }

  const ua = request.headers.get('user-agent') || '';
  const visitorKey = `${ip}-${ua.slice(0, 50)}`;
  const key = `${page}|${visitorKey}`;

  spectators.set(key, Date.now());
  cleanOld();

  return Response.json({ success: true, count: countForPage(page) }, { headers: rateLimitHeaders(rl) });
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/spectators', ip);

  cleanOld();

  const page = request.nextUrl.searchParams.get('page') || 'global';
  return Response.json({ success: true, count: countForPage(page) }, { headers: rateLimitHeaders(rl) });
}
