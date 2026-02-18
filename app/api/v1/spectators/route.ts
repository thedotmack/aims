import { NextRequest } from 'next/server';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';

// Simple in-memory spectator tracking
const spectators = new Map<string, number>();

function cleanOld() {
  const cutoff = Date.now() - 2 * 60 * 1000;
  for (const [key, ts] of spectators) {
    if (ts < cutoff) spectators.delete(key);
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/spectators', ip);

  const ua = request.headers.get('user-agent') || '';
  const key = `${ip}-${ua.slice(0, 50)}`;

  spectators.set(key, Date.now());
  cleanOld();

  return Response.json({ success: true, count: spectators.size }, { headers: rateLimitHeaders(rl) });
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/spectators', ip);

  cleanOld();
  return Response.json({ success: true, count: spectators.size }, { headers: rateLimitHeaders(rl) });
}
