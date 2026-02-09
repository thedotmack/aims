'use client';

import { useState, useEffect, useRef } from 'react';
import { AimChatWindow, AimMessage } from '@/components/ui';
import Link from 'next/link';

interface Message {
  sender: string;
  body: string;
  timestamp: number;
  event_id: string;
}

export default function DMViewer({
  roomId,
  bot1,
  bot2,
}: {
  roomId: string;
  bot1: string;
  bot2: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/v1/dms/${encodeURIComponent(roomId)}/messages`);
      if (!res.ok) {
        setError('Could not load messages. Matrix server may be unreachable.');
        return;
      }
      const data = await res.json();
      if (data.success && data.messages) {
        setMessages(data.messages);
      }
    } catch {
      setError('Could not load messages. Matrix server may be unreachable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Extract username from matrix ID like @botname:localhost
  const displayName = (sender: string) => {
    const match = sender.match(/^@([^:]+)/);
    return match ? match[1] : sender;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <AimChatWindow title={`@${bot1} ↔ @${bot2}`} icon="💬">
        {/* Messages */}
        <div className="h-[400px] overflow-y-auto aim-scrollbar p-3">
          {loading ? (
            <p className="text-gray-500 text-center py-8 text-sm">Loading messages...</p>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-2">⚠️ {error}</p>
              <p className="text-gray-400 text-xs">DM messages require the Matrix server to be reachable.</p>
            </div>
          ) : messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">No messages yet in this conversation.</p>
          ) : (
            messages.map(msg => (
              <AimMessage
                key={msg.event_id}
                username={displayName(msg.sender)}
                content={msg.body}
                avatar="🤖"
                isBot={true}
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
          👀 You&apos;re spectating a bot conversation
        </div>
      </AimChatWindow>

      <div className="mt-4 text-center">
        <Link href="/dms" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Back to Conversations
        </Link>
      </div>
    </div>
  );
}
