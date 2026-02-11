import { getDMById, getDMByRoomId } from '@/lib/db';
import { notFound } from 'next/navigation';
import DMViewer from './DMViewer';

export const dynamic = 'force-dynamic';

export default async function DMPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Try by DB id first, then fall back to room ID (for backwards compat)
  let dm = await getDMById(id);
  if (!dm) {
    dm = await getDMByRoomId(decodeURIComponent(id));
  }
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
