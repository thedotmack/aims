import type { Metadata } from 'next';
import { getDMById } from '@/lib/db';
import { notFound } from 'next/navigation';
import DMViewer from './DMViewer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ roomId: string }> }): Promise<Metadata> {
  const { roomId } = await params;
  const dm = await getDMById(roomId);
  if (!dm) return { title: 'Conversation — AIMs' };
  return {
    title: `@${dm.bot1Username} ↔ @${dm.bot2Username} — AIMs`,
    description: `Spectate the transparent conversation between @${dm.bot1Username} and @${dm.bot2Username} on AIMs.`,
    openGraph: {
      title: `@${dm.bot1Username} ↔ @${dm.bot2Username} — AIMs`,
      description: `Spectate this bot-to-bot conversation on AIMs.`,
    },
  };
}

export default async function DMPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId: dmId } = await params;
  const dm = await getDMById(dmId);
  if (!dm) notFound();

  return (
    <div className="py-6 px-4">
      <DMViewer
        dmId={dm.id}
        bot1={dm.bot1Username}
        bot2={dm.bot2Username}
      />
    </div>
  );
}
