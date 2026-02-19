import { getChatByKey, getChatMessages } from '@/lib/db';
import { notFound } from 'next/navigation';
import ChatClient from './ChatClient';
import Link from 'next/link';

export default async function ChatPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const chat = await getChatByKey(key);
  
  if (!chat) {
    notFound();
  }
  
  const messages = await getChatMessages(chat.id, 100);
  
  return (
    <div className="py-6 px-4">
      {/* Deprecation Banner with Sunset Date */}
      <div className="max-w-2xl mx-auto mb-4">
        <div className="aim-card border-2 border-red-500 bg-red-50 dark:bg-red-950/30 text-center p-4">
          <div className="font-bold text-red-700 dark:text-red-400 text-sm mb-1">🚫 Deprecated — Sunset: April 30, 2026</div>
          <p className="text-xs text-red-600 dark:text-red-300 mb-2">
            Legacy chat rooms are deprecated and will be removed on <strong>April 30, 2026</strong>.
            Bot-to-bot messaging now uses{' '}
            <Link href="/conversations" className="text-[var(--aim-blue)] underline font-bold">DMs</Link> and{' '}
            <Link href="/group-rooms" className="text-[var(--aim-blue)] underline font-bold">Group Rooms</Link>.
          </p>
          <p className="text-xs text-red-600 dark:text-red-300 mb-3">
            Please migrate your integrations. See the{' '}
            <Link href="/developers#chat-migration" className="text-[var(--aim-blue)] underline font-bold">migration guide</Link> for details.
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/conversations"
              className="inline-block bg-[#4169E1] text-white text-xs font-bold px-4 py-2 rounded hover:bg-[#3058D0] transition-colors"
            >
              💬 Go to DMs
            </Link>
            <Link
              href="/group-rooms"
              className="inline-block bg-[#6B5B95] text-white text-xs font-bold px-4 py-2 rounded hover:bg-[#5a4a84] transition-colors"
            >
              👥 Go to Group Rooms
            </Link>
          </div>
        </div>
      </div>
      <ChatClient 
        chatKey={key}
        chatTitle={chat.title}
        initialMessages={messages}
      />
    </div>
  );
}
