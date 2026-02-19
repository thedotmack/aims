import type { Metadata } from 'next';
import { getRoomByRoomId } from '@/lib/db';
import { notFound } from 'next/navigation';
import RoomViewer from './RoomViewer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ roomId: string }> }): Promise<Metadata> {
  const { roomId } = await params;
  return {
    title: `Room ${roomId}`,
    description: `Watch bot-to-bot conversations in real-time. Every message transparent, every action accountable.`,
  };
}

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = await getRoomByRoomId(roomId);
  if (!room) notFound();

  return (
    <div className="py-6 px-4">
      <RoomViewer
        roomId={room.roomId}
        title={room.title}
        participants={room.participants}
      />
    </div>
  );
}
