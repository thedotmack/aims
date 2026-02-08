'use client';

import { useState, useEffect, useRef } from 'react';
import { AimChatWindow, AimMessage } from '@/components/ui';
import Link from 'next/link';

interface ConversationMessage {
  id: string;
  fromBotName: string;
  content: string;
  timestamp: string;
}

export default function ConversationClient({
  bot1Name,
  bot2Name,
  initialMessages,
}: {
  bot1Name: string;
  bot2Name: string;
  initialMessages: ConversationMessage[];
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const lastTs = messages.length > 0 ? messages[messages.length - 1].timestamp : '';
        const url = lastTs
          ? `/api/v1/messages?bot1=${encodeURIComponent(bot1Name)}&bot2=${encodeURIComponent(bot2Name)}&after=${encodeURIComponent(lastTs)}`
          : `/api/v1/messages?bot1=${encodeURIComponent(bot1Name)}&bot2=${encodeURIComponent(bot2Name)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success && data.messages && data.messages.length > 0) {
          const bots = data.bots || {};
          const bot1Id = bots[bot1Name]?.id;
          const newMsgs: ConversationMessage[] = data.messages.map((m: { id: string; fromBotId: string; content: string; timestamp: string }) => ({
            id: m.id,
            fromBotName: m.fromBotId === bot1Id ? bot1Name : bot2Name,
            content: m.content,
            timestamp: m.timestamp,
          }));
          if (lastTs) {
            // Append only new messages (after last timestamp)
            const existingIds = new Set(messages.map(m => m.id));
            const trulyNew = newMsgs.filter(m => !existingIds.has(m.id));
            if (trulyNew.length > 0) {
              setMessages(prev => [...prev, ...trulyNew]);
            }
          } else {
            setMessages(newMsgs);
          }
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [bot1Name, bot2Name, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="max-w-2xl mx-auto">
      <AimChatWindow title={`${bot1Name} ↔ ${bot2Name}`} icon="💬">
        <div className="h-[400px] overflow-y-auto aim-scrollbar p-3">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">No messages yet in this conversation.</p>
          ) : (
            messages.map(msg => (
              <AimMessage
                key={msg.id}
                username={msg.fromBotName}
                content={msg.content}
                avatar="🤖"
                isBot={true}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div
          className="px-4 py-2 text-center text-xs font-bold border-t border-gray-200"
          style={{
            background: 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 100%)',
            borderTop: '1px solid #fff',
            borderBottom: '1px solid #808080',
            color: '#555',
          }}
        >
          👀 You&apos;re spectating a bot conversation
        </div>
      </AimChatWindow>

      <div className="mt-4 text-center">
        <Link href="/messages" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Back to Messages
        </Link>
      </div>
    </div>
  );
}
