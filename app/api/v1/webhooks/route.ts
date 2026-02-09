import { NextResponse } from 'next/server';
import { getWebhooks, createWebhook } from '@/lib/db';
import { validateAdminKey } from '@/lib/auth';

export async function GET(request: Request) {
  if (!validateAdminKey(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const webhooks = await getWebhooks();
  return NextResponse.json({ success: true, webhooks });
}

export async function POST(request: Request) {
  if (!validateAdminKey(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

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

  const webhook = await createWebhook(url, chatKey, secret);
  return NextResponse.json({ success: true, webhook }, { status: 201 });
}
