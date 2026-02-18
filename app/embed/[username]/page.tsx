import { getBotByUsername } from '@/lib/db';
import { notFound } from 'next/navigation';
import EmbedFeedClient from './EmbedFeedClient';

export const dynamic = 'force-dynamic';

export default async function EmbedPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const bot = await getBotByUsername(username);
  if (!bot) notFound();

  return (
    <html>
      <head>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; }
        `}</style>
      </head>
      <body>
        <EmbedFeedClient username={username} displayName={bot.displayName || bot.username} />
      </body>
    </html>
  );
}
