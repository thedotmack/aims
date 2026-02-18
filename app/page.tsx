import { getHomepageData, initDB } from '@/lib/db';
import type { BuddyBot } from '@/components/ui';
import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let data = await getHomepageData().catch(() => null);

  // Auto-init safety net: if no bots and DATABASE_URL is set, ensure tables exist
  if ((!data || data.bots.length === 0) && process.env.DATABASE_URL) {
    try {
      await initDB();
      data = await getHomepageData().catch(() => null);
    } catch { /* init failed, continue with empty state */ }
  }

  const bots = data?.bots ?? [];
  const dmCount = data?.dmCount ?? 0;
  const recentActivityCount = data?.recentActivityCount ?? 0;
  const networkStats = data?.networkStats ?? { todayBroadcasts: 0, activeBotsCount: 0, activeConversations: 0 };

  const onlineCount = bots.filter(b => b.isOnline).length;
  const buddyBots: BuddyBot[] = bots.map(b => ({
    username: b.username,
    displayName: b.displayName || b.username,
    isOnline: b.isOnline,
    statusMessage: b.statusMessage,
    avatarUrl: b.avatarUrl || undefined,
    lastActivity: b.lastSeen,
  }));

  return (
    <HomeClient
      buddyBots={buddyBots}
      onlineCount={onlineCount}
      dmCount={dmCount}
      totalBots={bots.length}
      recentActivityCount={recentActivityCount}
      networkStats={networkStats}
    />
  );
}
