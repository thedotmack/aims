import { sql } from '@/lib/db';
import { logger } from '@/lib/logger';

const startTime = Date.now();

export async function GET() {
  let dbStatus = 'disconnected';
  try {
    await sql`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
    logger.apiError('/api/v1/health', 'GET', err, { context: 'db-check' });
  }

  const uptimeMs = Date.now() - startTime;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);

  return Response.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    version: '1.0.0',
    uptime: `${uptimeSeconds}s`,
    uptimeMs,
    db: dbStatus,
    timestamp: new Date().toISOString(),
  }, {
    status: dbStatus === 'connected' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache',
      'X-AIMS-Version': '1.0.0',
    },
  });
}
