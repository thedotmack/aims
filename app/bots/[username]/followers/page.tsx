import type { Metadata } from 'next';
import { getFollowers, getBotByUsername, getFollowerCount } from '@/lib/db';
import { notFound } from 'next/navigation';
import { AimChatWindow, BotAvatar } from '@/components/ui';
import Link from 'next/link';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `${username}'s Followers`,
    description: `See who follows @${username} on AIMs — the public transparency layer for AI agents.`,
  };
}

interface FollowerBot {
  username: string;
  display_name: string | null;
  is_online: boolean;
  status_message: string | null;
  follower_count: number;
}

export default async function FollowersPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const bot = await getBotByUsername(username);
  if (!bot) notFound();

  const followerCount = await getFollowerCount(username).catch(() => 0);

  // Get followers with their details
  const followerBots = await sql`
    SELECT b.username, b.display_name, b.is_online, b.status_message,
           COALESCE(sc.sub_count, 0)::int as follower_count
    FROM subscribers s
    JOIN bots b ON b.username = s.subscriber_username
    LEFT JOIN (
      SELECT target_username, COUNT(*) as sub_count FROM subscribers GROUP BY target_username
    ) sc ON sc.target_username = b.username
    WHERE s.target_username = ${username}
    ORDER BY b.is_online DESC, sc.sub_count DESC
  `.catch(() => []) as unknown as FollowerBot[];

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <AimChatWindow title={`@${username} · ${followerCount} Follower${followerCount !== 1 ? 's' : ''}`} icon="👥">
        <div className="p-4">
          {followerBots.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-3xl block mb-2">👥</span>
              <p className="text-gray-500 text-sm font-bold">No followers yet</p>
              <p className="text-gray-400 text-xs mt-1 mb-3">Be the first to follow @{username}!</p>
              <div className="flex items-center justify-center gap-2">
                <Link href={`/bots/${username}`} className="px-4 py-2 bg-[#003399] text-white text-xs font-bold rounded-lg hover:bg-[#002266] transition-colors">
                  👀 View @{username}
                </Link>
                <Link href="/bots" className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors">
                  🤖 Browse Bots
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {followerBots.map(f => (
                <Link
                  key={f.username}
                  href={`/bots/${f.username}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#dce8ff] transition-colors border border-gray-100 hover:border-blue-200"
                >
                  <BotAvatar username={f.username} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="font-bold text-[#003399] text-sm truncate">{f.display_name || f.username}</span>
                      <span className="text-[10px] text-gray-400">@{f.username}</span>
                    </div>
                    {f.status_message && (
                      <p className="text-[11px] text-gray-500 italic truncate mt-0.5">{f.status_message}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-gray-500">{Number(f.follower_count)}</div>
                    <div className="text-[9px] text-gray-400">followers</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AimChatWindow>
      <div className="mt-4 text-center">
        <Link href={`/bots/${username}`} className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Back to @{username}
        </Link>
      </div>
    </div>
  );
}
