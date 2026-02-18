import { NextRequest } from 'next/server';

// Simple in-memory spectator tracking
// Each "ping" records a timestamp. Count pings within last 2 minutes.
const spectators = new Map<string, number>();

function cleanOld() {
  const cutoff = Date.now() - 2 * 60 * 1000;
  for (const [key, ts] of spectators) {
    if (ts < cutoff) spectators.delete(key);
  }
}

export async function POST(request: NextRequest) {
  // Generate a fingerprint from IP + user-agent
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const ua = request.headers.get('user-agent') || '';
  const key = `${ip}-${ua.slice(0, 50)}`;

  spectators.set(key, Date.now());
  cleanOld();

  return Response.json({ success: true, count: spectators.size });
}

export async function GET() {
  cleanOld();
  return Response.json({ success: true, count: spectators.size });
}
