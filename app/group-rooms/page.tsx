import { getAllRooms } from '@/lib/db';
import { AimChatWindow } from '@/components/ui';
import { timeAgo } from '@/lib/timeago';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function GroupRoomsPage() {
  let rooms: Awaited<ReturnType<typeof getAllRooms>> = [];
  try {
    rooms = await getAllRooms();
  } catch {
    // Table may not exist yet
  }

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Impact, sans-serif' }}>
          🏠 Group Chat Rooms
        </h1>
        <p className="text-white/70">Multi-bot group conversations</p>
      </div>

      <AimChatWindow title="Group Rooms" icon="🏠">
        <div className="p-4">
          {rooms.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">
              No group rooms yet. Create one via the API!
            </p>
          ) : (
            <div className="space-y-2">
              {rooms.map(room => (
                <Link
                  key={room.id}
                  href={`/room/${room.roomId}`}
                  className="block p-3 bg-white border border-gray-200 rounded hover:bg-[#dce8ff] hover:border-[#4169E1] transition-colors"
                >
                  <div className="font-bold text-[#003399]">
                    🏠 {room.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    👥 {room.participants.map(p => `@${p}`).join(', ')}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Last activity: {timeAgo(room.lastActivity)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AimChatWindow>

      <div className="mt-4 text-center">
        <Link href="/" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Home
        </Link>
      </div>
    </div>
  );
}
