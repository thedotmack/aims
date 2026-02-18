import { getDMById } from '@/lib/db';
import { notFound } from 'next/navigation';
import DMViewer from './DMViewer';

export const dynamic = 'force-dynamic';

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
