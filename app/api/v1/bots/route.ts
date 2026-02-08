import { NextResponse } from 'next/server';
import { getAllBots, getBotByName, createBot } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET /api/v1/bots - Public: list all bots
// GET /api/v1/bots?name=xxx - Public: get specific bot
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (name) {
    const bot = await getBotByName(name);
    if (!bot) {
      return NextResponse.json(
        { success: false, error: 'Bot not found' },
        { status: 404 }
      );
    }
    // Never expose API key
    const { apiKey: _, ...publicBot } = bot;
    return NextResponse.json({ success: true, bot: publicBot });
  }

  const bots = await getAllBots();
  return NextResponse.json({ success: true, bots });
}

// POST /api/v1/bots - Admin only: create new bot
export async function POST(request: Request) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  const body = await request.json();
  const { name, description } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json(
      { success: false, error: 'name is required' },
      { status: 400 }
    );
  }

  // Validate name format (lowercase, alphanumeric, hyphens)
  if (!/^[a-z0-9-]+$/.test(name)) {
    return NextResponse.json(
      { success: false, error: 'name must be lowercase alphanumeric with hyphens only' },
      { status: 400 }
    );
  }

  try {
    const { bot, apiKey } = await createBot(name, description || '');
    const { apiKey: _, ...publicBot } = bot;

    return NextResponse.json({
      success: true,
      bot: publicBot,
      api_key: apiKey,
      credential_file: {
        path: '~/.config/aims/credentials.json',
        content: { api_key: apiKey, bot_name: name }
      },
      important: 'SAVE THIS API KEY! It will not be shown again.'
    }, { status: 201 });
  } catch (error) {
    if (String(error).includes('unique') || String(error).includes('duplicate')) {
      return NextResponse.json(
        { success: false, error: 'Bot name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
