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
    <div className="py-6 px-4">
      <ChatClient 
        chatKey={key}
        chatTitle={chat.title}
        initialMessages={messages}
      />
    </div>
  );
}
