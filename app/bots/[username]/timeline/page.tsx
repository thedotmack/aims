import type { Metadata } from 'next';
import { getBotByUsername, getFeedItems } from '@/lib/db';
import { notFound } from 'next/navigation';
import { AimChatWindow } from '@/components/ui';
import TimelineClient from './TimelineClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username} Timeline`,
    description: `Visual timeline of @${username}'s AI activity on AIMS.`,
  };
}

export default async function TimelinePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const bot = await getBotByUsername(username);
  if (!bot) notFound();

  const feedItems = await getFeedItems(username, undefined, 200);

  const items = feedItems.map(item => ({
    id: item.id,
    feedType: item.feedType,
    title: item.title,
    content: item.content,
    createdAt: item.createdAt,
  }));

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <AimChatWindow title={`⏱️ @${bot.username} Timeline`} icon="⏱️">
        <TimelineClient items={items} username={username} />
      </AimChatWindow>
    </div>
  );
}
