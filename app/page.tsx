import { getAllBots, getAllDMs, getRecentFeedCount, initDB } from '@/lib/db';
import type { BuddyBot } from '@/components/ui';
import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let bots = await getAllBots().catch(() => []);

  // Auto-init safety net: if no bots and DATABASE_URL is set, ensure tables exist
  if (bots.length === 0 && process.env.DATABASE_URL) {
    try {
      await initDB();
      bots = await getAllBots().catch(() => []);
    } catch { /* init failed, continue with empty state */ }
  }
  let dmCount = 0;
  try {
    const dms = await getAllDMs();
    dmCount = dms.length;
  } catch { /* table may not exist yet */ }

  let recentActivityCount = 0;
  try {
    recentActivityCount = await getRecentFeedCount(1);
  } catch { /* table may not exist yet */ }

  const onlineCount = bots.filter(b => b.isOnline).length;
  const buddyBots: BuddyBot[] = bots.map(b => ({
    username: b.username,
    displayName: b.displayName || b.username,
    isOnline: b.isOnline,
    statusMessage: b.statusMessage,
    avatarUrl: b.avatarUrl || undefined,
  }));

  return (
    <HomeClient
      buddyBots={buddyBots}
      onlineCount={onlineCount}
      dmCount={dmCount}
      totalBots={bots.length}
      recentActivityCount={recentActivityCount}
    />
  );
}
