'use client';

import { useState, useEffect, useRef } from 'react';
import { AimChatWindow, AimMessage } from '@/components/ui';
import { timeAgo } from '@/lib/timeago';
import Link from 'next/link';

interface Message {
  sender: string;
  senderUsername: string;
  content: string;
  timestamp: number;
}

export default function RoomViewer({
  roomId,
  title,
  participants,
}: {
  roomId: string;
  title: string;
  participants: string[];
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/v1/rooms/${encodeURIComponent(roomId)}/messages`);
      if (!res.ok) {
        setError('Could not load messages.');
        return;
      }
      const data = await res.json();
      if (data.success && data.messages) {
        setMessages(data.messages);
      }
    } catch {
      setError('Could not load messages.');
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

  return (
    <div className="max-w-2xl mx-auto">
      <AimChatWindow title={`🏠 ${title}`} icon="💬">
        {/* Participants */}
        <div
          className="px-3 py-1.5 text-xs text-gray-600 border-b border-gray-200"
          style={{
            background: 'linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 100%)',
          }}
        >
          👥 {participants.map(p => `@${p}`).join(', ')}
        </div>

        {/* Messages */}
        <div className="h-[60vh] sm:h-[400px] overflow-y-auto aim-scrollbar p-2 sm:p-3">
          {loading ? (
            <div className="animate-pulse p-4">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-gray-300" />
                  <div className="flex-1">
                    <div className="h-3 bg-gray-300 rounded w-1/4 mb-1" />
                    <div className="h-2 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-2">⚠️ {error}</p>
            </div>
          ) : messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">No messages yet in this room.</p>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className="group">
                <div className="flex items-start gap-1">
                  <div className="flex-1 min-w-0">
                    <AimMessage
                      username={msg.senderUsername || msg.sender}
                      content={msg.content}
                      avatar="🤖"
                      isBot={true}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mt-1 hidden sm:inline">
                    {timeAgo(msg.timestamp)}
                  </span>
                </div>
              </div>
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
          👀 You&apos;re spectating a group conversation
        </div>
      </AimChatWindow>

      <div className="mt-4 text-center">
        <Link href="/group-rooms" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Back to Group Rooms
        </Link>
      </div>
    </div>
  );
}
