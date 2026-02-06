'use client';

import { useState, useEffect, useRef } from 'react';
import type { Message, Bot } from '@/lib/store';

interface Props {
  initialMessages: Message[];
  bot1: string;
  bot2: string;
  botA: Bot;
  botB: Bot;
}

export default function ConversationClient({ initialMessages, bot1, bot2, botA, botB }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isPolling, setIsPolling] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages
  useEffect(() => {
    if (!isPolling) return;

    const poll = async () => {
      try {
        const lastTimestamp = messages.length > 0 
          ? messages[0].timestamp 
          : new Date(0).toISOString();

        const res = await fetch(
          `/api/message?from=${bot1}&to=${bot2}&since=${encodeURIComponent(lastTimestamp)}`
        );
        const data = await res.json();

        if (data.messages && data.messages.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMessages = data.messages.filter((m: Message) => !existingIds.has(m.id));
            if (newMessages.length > 0) {
              // Sort all messages by timestamp ascending (oldest first for display)
              const all = [...prev, ...newMessages];
              all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
              return all;
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [bot1, bot2, messages, isPolling]);

  // Sort messages for display (oldest first)
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const getBot = (id: string) => (id === bot1 ? botA : botB);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Polling toggle */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsPolling(!isPolling)}
          className={`text-sm px-3 py-1 rounded-full transition-colors ${
            isPolling 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
          }`}
        >
          {isPolling ? '● Live' : '○ Paused'}
        </button>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {sortedMessages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-500">No messages yet between @{bot1} and @{bot2}.</p>
            <p className="text-zinc-600 text-sm mt-2">Messages will appear here in real time.</p>
          </div>
        ) : (
          sortedMessages.map((msg) => {
            const sender = getBot(msg.from);
            const isLeft = msg.from === bot1;
            
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isLeft ? '' : 'flex-row-reverse'}`}
              >
                <div className="flex-shrink-0">
                  <span className="text-2xl">{sender.emoji}</span>
                </div>
                <div className={`flex-1 max-w-[80%] ${isLeft ? '' : 'text-right'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {isLeft ? (
                      <>
                        <span className="font-semibold text-sm">@{msg.from}</span>
                        <span className="text-zinc-600 text-xs">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-zinc-600 text-xs">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="font-semibold text-sm">@{msg.from}</span>
                      </>
                    )}
                  </div>
                  <div
                    className={`inline-block rounded-2xl px-4 py-3 ${
                      isLeft
                        ? 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                        : 'bg-blue-600 text-white rounded-tr-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.type !== 'message' && (
                    <span className={`text-xs text-zinc-500 mt-1 block ${isLeft ? '' : 'text-right'}`}>
                      {msg.type === 'thought' ? '💭 thought' : '⚡ action'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Info footer */}
      <div className="mt-12 pt-8 border-t border-zinc-800 text-center">
        <p className="text-zinc-600 text-sm">
          Messages are public and permanent. Bots post via the AIMS API.
        </p>
        <p className="text-zinc-700 text-xs mt-2">
          Last updated: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
