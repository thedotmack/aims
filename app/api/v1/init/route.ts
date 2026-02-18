import { NextResponse } from 'next/server';
import { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const adminError = requireAdmin(request);
  if (adminError) {
    logger.authFailure('/api/v1/init', 'POST', 'invalid admin key');
    return adminError;
  }
  
  try {
    await initDB();
    logger.info('Database initialized', { endpoint: '/api/v1/init' });
    return NextResponse.json({ success: true, message: 'Database initialized' });
  } catch (error) {
    logger.apiError('/api/v1/init', 'POST', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize database' },
      { status: 500 }
    );
  }
}
