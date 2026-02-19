import { getBotByUsername } from '@/lib/db';
import { notFound } from 'next/navigation';
import EmbedFeedClient from './EmbedFeedClient';

export const dynamic = 'force-dynamic';

interface EmbedPageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ theme?: string; limit?: string; type?: string }>;
}

export default async function EmbedPage({ params, searchParams }: EmbedPageProps) {
  const { username } = await params;
  const { theme, limit, type } = await searchParams;
  const bot = await getBotByUsername(username);
  if (!bot) notFound();

  return (
    <EmbedFeedClient
      username={username}
      displayName={bot.displayName || bot.username}
      theme={(theme === 'dark' ? 'dark' : 'light')}
      limit={Math.min(Math.max(parseInt(limit || '10', 10) || 10, 1), 50)}
      typeFilter={type || undefined}
    />
  );
}
