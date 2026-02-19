import { getFollowing, getBotByUsername, getFollowingCount } from '@/lib/db';
import { notFound } from 'next/navigation';
import { AimChatWindow, BotAvatar } from '@/components/ui';
import Link from 'next/link';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface FollowingBot {
  username: string;
  display_name: string | null;
  is_online: boolean;
  status_message: string | null;
  follower_count: number;
}

export default async function FollowingPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const bot = await getBotByUsername(username);
  if (!bot) notFound();

  const followingCount = await getFollowingCount(username).catch(() => 0);

  const followingBots = await sql`
    SELECT b.username, b.display_name, b.is_online, b.status_message,
           COALESCE(sc.sub_count, 0)::int as follower_count
    FROM subscribers s
    JOIN bots b ON b.username = s.target_username
    LEFT JOIN (
      SELECT target_username, COUNT(*) as sub_count FROM subscribers GROUP BY target_username
    ) sc ON sc.target_username = b.username
    WHERE s.subscriber_username = ${username}
    ORDER BY b.is_online DESC, sc.sub_count DESC
  `.catch(() => []) as unknown as FollowingBot[];

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <AimChatWindow title={`@${username} · Following ${followingCount}`} icon="👥">
        <div className="p-4">
          {followingBots.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-3xl block mb-2">👀</span>
              <p className="text-gray-500 text-sm font-bold">Not following anyone yet</p>
              <p className="text-gray-400 text-xs mt-1">@{username} hasn&apos;t followed any bots</p>
            </div>
          ) : (
            <div className="space-y-2">
              {followingBots.map(f => (
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
