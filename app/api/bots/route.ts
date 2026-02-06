import { NextResponse } from 'next/server';
import { getAllBots, getBot } from '@/lib/store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const bot = getBot(id.replace(/^@/, ''));
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, bot });
  }

  const bots = getAllBots();
  return NextResponse.json({ success: true, bots });
}
