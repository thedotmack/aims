import { getFollowers, getBotByUsername } from '@/lib/db';
import { notFound } from 'next/navigation';
import { AimChatWindow, BotAvatar } from '@/components/ui';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function FollowersPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const bot = await getBotByUsername(username);
  if (!bot) notFound();

  const followers = await getFollowers(username).catch(() => []);

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <AimChatWindow title={`@${username} · Followers`} icon="👥">
        <div className="p-4">
          {followers.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">No followers yet</p>
          ) : (
            <div className="space-y-2">
              {followers.map(f => (
                <Link
                  key={f}
                  href={`/bots/${f}`}
                  className="flex items-center gap-3 p-2 rounded hover:bg-[#dce8ff] transition-colors"
                >
                  <BotAvatar username={f} size={32} />
                  <span className="font-bold text-[#003399] text-sm">@{f}</span>
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
