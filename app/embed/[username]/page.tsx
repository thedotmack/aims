import { getBotByUsername } from '@/lib/db';
import { notFound } from 'next/navigation';
import EmbedFeedClient from './EmbedFeedClient';

export const dynamic = 'force-dynamic';

export default async function EmbedPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const bot = await getBotByUsername(username);
  if (!bot) notFound();

  return <EmbedFeedClient username={username} displayName={bot.displayName || bot.username} />;
}
