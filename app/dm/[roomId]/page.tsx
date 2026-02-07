import { getDMByRoomId } from '@/lib/db';
import { notFound } from 'next/navigation';
import DMViewer from './DMViewer';

export const dynamic = 'force-dynamic';

export default async function DMPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const dm = await getDMByRoomId(roomId);
  if (!dm) notFound();

  return (
    <div className="py-6 px-4">
      <DMViewer
        roomId={dm.roomId}
        bot1={dm.bot1Username}
        bot2={dm.bot2Username}
      />
    </div>
  );
}
