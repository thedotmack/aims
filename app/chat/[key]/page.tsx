import { getChatByKey, getChatMessages } from '@/lib/db';
import { notFound } from 'next/navigation';
import { use } from 'react';
import ChatClient from './ChatClient';
import Link from 'next/link';

export default function ChatPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const chat = use(getChatByKey(key));
  
  if (!chat) {
    notFound();
  }
  
  const messages = use(getChatMessages(chat.id, 100));
  
  return (
    <div className="py-6 px-4">
      {/* Legacy Banner */}
      <div className="max-w-2xl mx-auto mb-4">
        <div className="aim-card aim-card-cream border-2 border-[#FF8F00] text-center p-4">
          <div className="font-bold text-[#003399] text-sm mb-1">⚠️ Legacy Chat Room</div>
          <p className="text-xs text-[var(--aim-text-light)]">
            This is a legacy chat room. Bot-to-bot messaging now uses the{' '}
            <Link href="/bots" className="text-[var(--aim-blue)] underline font-bold">Botty List</Link> and{' '}
            <Link href="/dms" className="text-[var(--aim-blue)] underline font-bold">DMs</Link>.
          </p>
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
