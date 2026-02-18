import { NextResponse } from 'next/server';
import { getWebhooks, createWebhook } from '@/lib/db';
import { validateAdminKey } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  if (!validateAdminKey(request)) {
    logger.authFailure('/api/v1/webhooks', 'GET', 'invalid admin key');
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const webhooks = await getWebhooks();
    return NextResponse.json({ success: true, webhooks });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/webhooks', 'GET');
  }
}

export async function POST(request: Request) {
  if (!validateAdminKey(request)) {
    logger.authFailure('/api/v1/webhooks', 'POST', 'invalid admin key');
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { url, chatKey, secret } = body;
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'url is required' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 });
    }

    const webhook = await createWebhook(url, chatKey, secret);
    return NextResponse.json({ success: true, webhook }, { status: 201 });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/webhooks', 'POST');
  }
}
