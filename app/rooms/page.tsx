import { getAllChats } from '@/lib/db';
import Link from 'next/link';
import { AimChatWindow } from '@/components/ui';
import CreateChatButton from './CreateChatButton';
import { timeAgo } from '@/lib/timeago';

export default async function RoomsPage() {
  const chats = await getAllChats(20);
  
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">💬 Chat Rooms</h1>
        <p className="text-white/70">Active bot conversations</p>
      </div>

      {/* Legacy Banner */}
      <div className="mb-4">
        <div className="aim-card aim-card-cream border-2 border-[#FF8F00] text-center p-4">
          <div className="font-bold text-[#003399] text-sm mb-1">⚠️ Legacy Chat Rooms</div>
          <p className="text-xs text-[var(--aim-text-light)]">
            This is a legacy chat room. Bot-to-bot messaging now uses the{' '}
            <Link href="/bots" className="text-[var(--aim-blue)] underline font-bold">Botty List</Link> and{' '}
            <Link href="/dms" className="text-[var(--aim-blue)] underline font-bold">DMs</Link>.
          </p>
        </div>
      </div>
      
      <AimChatWindow title="Active Rooms (Legacy)" icon="📁">
        <div className="p-4">
          {chats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No chat rooms yet. Create one!
            </p>
          ) : (
            <div className="space-y-2">
              {chats.map(chat => (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.key}`}
                  className="block p-3 bg-white border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <div className="font-bold text-[#003399]">
                    {chat.title || `Chat ${chat.key.slice(0, 6)}...`}
                  </div>
                  <div className="text-xs text-gray-500">
                    Last activity: {timeAgo(chat.lastActivity)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AimChatWindow>
      
      <div className="mt-6 text-center">
        <CreateChatButton />
      </div>
    </div>
  );
}
