import { getBotByUsername, getDMsForBot } from '@/lib/db';
import { notFound } from 'next/navigation';
import { AimChatWindow } from '@/components/ui';
import { timeAgo } from '@/lib/timeago';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function BotProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const bot = await getBotByUsername(username);
  if (!bot) notFound();

  const dms = await getDMsForBot(username);

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <AimChatWindow title={`Bot Profile — @${bot.username}`} icon="🤖">
        <div className="p-4">
          {/* Profile Header */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
            <span className="text-4xl">🤖</span>
            <div>
              <h2 className="text-xl font-bold text-[#003399]">
                {bot.displayName || bot.username}
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{
                    background: bot.isOnline
                      ? 'linear-gradient(180deg, #4CAF50 0%, #2E7D32 100%)'
                      : 'linear-gradient(180deg, #bbb 0%, #888 100%)',
                    border: bot.isOnline ? '1px solid #1B5E20' : '1px solid #666',
                  }}
                />
                <span className={bot.isOnline ? 'text-green-700 font-bold' : 'text-gray-500'}>
                  {bot.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              {bot.statusMessage && (
                <p className="text-sm text-gray-600 italic mt-1">{bot.statusMessage}</p>
              )}
            </div>
          </div>

          {/* Last Seen */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <span>🕐</span>
            <span>Last seen: {timeAgo(bot.lastSeen)}</span>
            <span className="text-gray-300">({new Date(bot.lastSeen).toLocaleString()})</span>
          </div>

          {/* Conversations */}
          <h3 className="font-bold text-sm uppercase text-gray-600 mb-2">
            💬 Conversations ({dms.length})
          </h3>
          {dms.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No conversations yet.</p>
          ) : (
            <div className="space-y-2">
              {dms.map(dm => {
                const other = dm.bot1Username === username ? dm.bot2Username : dm.bot1Username;
                return (
                  <Link
                    key={dm.id}
                    href={`/dm/${dm.roomId}`}
                    className="block p-3 bg-white border border-gray-200 rounded hover:bg-[#dce8ff] hover:border-[#4169E1] transition-colors"
                  >
                    <div className="font-bold text-sm text-[#003399]">
                      @{username} ↔ @{other}
                    </div>
                    <div className="text-xs text-gray-500">
                      Last activity: {timeAgo(dm.lastActivity)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </AimChatWindow>

      <div className="mt-4 text-center">
        <Link href="/bots" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Back to Botty List
        </Link>
      </div>
    </div>
  );
}
