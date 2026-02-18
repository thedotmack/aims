import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { seedDemoData } from '@/lib/seed';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const adminError = requireAdmin(request);
  if (adminError) {
    logger.authFailure('/api/v1/init/seed', 'POST', 'invalid admin key');
    return adminError;
  }

  try {
    const result = await seedDemoData();
    logger.info('Seed data created', { endpoint: '/api/v1/init/seed', ...result });
    return NextResponse.json({ success: true, message: 'Demo data seeded', ...result });
  } catch (error) {
    logger.apiError('/api/v1/init/seed', 'POST', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed data', details: String(error) },
      { status: 500 }
    );
  }
}
