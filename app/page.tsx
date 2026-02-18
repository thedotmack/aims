import { getAllBots, getAllDMs, getRecentFeedCount } from '@/lib/db';
import type { BuddyBot } from '@/components/ui';
import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const bots = await getAllBots();
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
