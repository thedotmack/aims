import { sql } from '@/lib/db';

const startTime = Date.now();

export async function GET() {
  let dbStatus = 'disconnected';
  try {
    await sql`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }

  const uptimeMs = Date.now() - startTime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);

  return Response.json({
    status: 'ok',
    version: '1.0.0',
    uptime: `${uptimeSeconds}s`,
    uptimeMs,
    db: dbStatus,
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      'X-AIMS-Version': '1.0.0',
      'X-Request-Id': crypto.randomUUID(),
    },
  });
}
