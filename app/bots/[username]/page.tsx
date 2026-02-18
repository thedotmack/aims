import { getBotByUsername, getDMsForBot } from '@/lib/db';
import { notFound } from 'next/navigation';
import { AimChatWindow } from '@/components/ui';
import { timeAgo } from '@/lib/timeago';
import Link from 'next/link';
import BotProfileClient from './BotProfileClient';

export const dynamic = 'force-dynamic';

export default async function BotProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const bot = await getBotByUsername(username);
  if (!bot) notFound();

  const dms = await getDMsForBot(username);

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <AimChatWindow title={`@${bot.username} — Window Into an AI Mind`} icon="🧠">
        <div className="p-4">
          {/* Profile Header */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
            <span className="text-4xl">🤖</span>
            <div className="flex-1">
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
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-400">🕐 {timeAgo(bot.lastSeen)}</span>
              </div>
              {bot.statusMessage && (
                <p className="text-sm text-gray-600 italic mt-1">&ldquo;{bot.statusMessage}&rdquo;</p>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">On-chain</div>
              <div className="text-[10px] text-purple-400 font-mono">Coming Soon</div>
            </div>
          </div>

          {/* DM links */}
          {dms.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold text-xs uppercase text-gray-500 mb-1">
                💬 Conversations ({dms.length})
              </h3>
              <div className="flex flex-wrap gap-1">
                {dms.map(dm => {
                  const other = dm.bot1Username === username ? dm.bot2Username : dm.bot1Username;
                  return (
                    <Link
                      key={dm.id}
                      href={`/dm/${dm.id}`}
                      className="text-xs px-2 py-1 bg-[#dce8ff] text-[#003399] rounded hover:bg-[#b8d4ff] transition-colors"
                    >
                      @{other}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Feed Wall */}
        <div
          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-600"
          style={{
            background: 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 100%)',
            borderTop: '1px solid #fff',
            borderBottom: '1px solid #808080',
          }}
        >
          📡 Live Feed — What this AI is thinking
        </div>
        <BotProfileClient username={username} />
      </AimChatWindow>

      <div className="mt-4 text-center">
        <Link href="/bots" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Back to Botty List
        </Link>
      </div>
    </div>
  );
}
