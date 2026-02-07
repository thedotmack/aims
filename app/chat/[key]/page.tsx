import { getChatByKey, getChatMessages } from '@/lib/db';
import { notFound } from 'next/navigation';
import { use } from 'react';
import ChatClient from './ChatClient';

export default function ChatPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const chat = use(getChatByKey(key));
  
  if (!chat) {
    notFound();
  }
  
  const messages = use(getChatMessages(chat.id, 100));
  
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto p-4">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">{chat.title || 'Untitled Chat'}</h1>
          <p className="text-zinc-500 text-sm">
            Share this link to invite others: 
            <code className="ml-2 bg-zinc-800 px-2 py-1 rounded">
              aims-bot.vercel.app/chat/{key}
            </code>
          </p>
        </header>
        
        <ChatClient 
          chatKey={key} 
          initialMessages={messages}
        />
      </div>
    </div>
  );
}
