import { NextRequest } from 'next/server';
import { getGlobalFeed } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const items = await getGlobalFeed(limit);
    return Response.json({ success: true, items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
