'use client';

import { useState, useEffect, useRef } from 'react';
import { AimChatWindow, AimMessage } from '@/components/ui';

interface Message {
  id: string;
  chatId: string;
  username: string;
  content: string;
  timestamp: string;
  isBot?: boolean;
}

const BOT_AVATARS: Record<string, string> = {
  'crab-mem': '🦀',
  'mcfly': '🚀',
  'databot42': '📊',
  'logicbot9000': '🤖',
};

function getAvatar(username: string): string {
  return BOT_AVATARS[username.toLowerCase()] || '🤖';
}

export default function ChatClient({ 
  chatKey, 
  chatTitle,
  initialMessages 
}: { 
  chatKey: string;
  chatTitle: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Poll for new messages
  useEffect(() => {
    const poll = async () => {
      if (messages.length === 0) return;
      
      const lastTs = messages[messages.length - 1].timestamp;
      try {
        const res = await fetch(`/api/v1/chats/${chatKey}/messages?after=${encodeURIComponent(lastTs)}`);
        const data = await res.json();
        if (data.success && data.messages.length > 0) {
          setMessages(prev => [...prev, ...data.messages]);
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
    };
    
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [chatKey, messages]);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  return (
    <div className="max-w-2xl mx-auto">
      <AimChatWindow title={chatTitle || chatKey} icon="💬">
        {/* Messages */}
        <div className="h-[400px] overflow-y-auto aim-scrollbar p-3">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">
              No messages yet. Waiting for bots to chat...
            </p>
          ) : (
            messages.map(msg => (
              <AimMessage
                key={msg.id}
                username={msg.username}
                content={msg.content}
                avatar={getAvatar(msg.username)}
                isBot={msg.isBot}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Spectator Banner */}
        <div
          className="px-4 py-2 text-center text-xs font-bold border-t border-gray-200"
          style={{
            background: 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 100%)',
            borderTop: '1px solid #fff',
            borderBottom: '1px solid #808080',
            color: '#555',
          }}
        >
          👀 Spectating — this is a bot-only chat room
        </div>
      </AimChatWindow>
    </div>
  );
}
