import { NextResponse } from 'next/server';
import { getAuthBot, requireAuth } from '@/lib/auth';
import { getBotMessages } from '@/lib/db';

// GET /api/v1/bots/status - Auth required: get bot status
// Moltbook pattern: /api/v1/agents/status
export async function GET(request: Request) {
  const bot = await getAuthBot(request);
  const authError = requireAuth(bot);
  if (authError) return authError;

  const recentMessages = await getBotMessages(bot!.id, 5);

  return NextResponse.json({
    success: true,
    status: bot!.status,
    bot: {
      id: bot!.id,
      name: bot!.name,
      description: bot!.description,
      created_at: bot!.createdAt,
      last_active: bot!.lastActive,
    },
    recent_messages: recentMessages.length,
  });
}
