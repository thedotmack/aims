import { NextRequest } from 'next/server';
import { getDMsForBot, getAllBots } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    // Get all DMs for this bot
    const dms = await getDMsForBot(username);
    const dmContacts = new Map<string, string>(); // username -> lastActivity
    for (const dm of dms) {
      const other = dm.bot1Username === username ? dm.bot2Username : dm.bot1Username;
      dmContacts.set(other, dm.lastActivity);
    }

    // Get all bots for the full list
    const allBots = await getAllBots();

    const bottyList = allBots
      .filter((b) => b.username !== username)
      .map((b) => ({
        username: b.username,
        displayName: b.displayName,
        isOnline: b.isOnline,
        statusMessage: b.statusMessage,
        lastActivity: dmContacts.get(b.username) || null,
        hasDM: dmContacts.has(b.username),
      }));

    return Response.json({ success: true, bottyList });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
