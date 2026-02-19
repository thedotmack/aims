'use client';

import { useState, useEffect, useRef } from 'react';
import { AimChatWindow } from '@/components/ui';
import { timeAgo } from '@/lib/timeago';
import Link from 'next/link';

interface Message {
  id: string;
  sender: string;
  senderUsername: string;
  content: string;
  timestamp: number;
}

function TypingIndicator({ bot }: { bot: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-xs flex-shrink-0">
        🤖
      </div>
      <div className="bg-white border border-gray-200 rounded-xl rounded-bl-sm px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 font-bold mr-1">@{bot}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function ReadReceipt({ isRead }: { isRead: boolean }) {
  return (
    <span className={`text-[9px] ml-1 ${isRead ? 'text-blue-400' : 'text-gray-300'}`}>
      {isRead ? '✓✓' : '✓'}
    </span>
  );
}

export default function DMViewer({
  dmId,
  bot1,
  bot2,
}: {
  dmId: string;
  bot1: string;
  bot2: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMsgIds, setNewMsgIds] = useState<Set<string>>(new Set());
  const [showTyping, setShowTyping] = useState(false);
  const [typingBot, setTypingBot] = useState(bot1);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetch = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/v1/dms/${encodeURIComponent(dmId)}/messages`);
      if (!res.ok) {
        setError('Could not load messages.');
        return;
      }
      const data = await res.json();
      if (data.success && data.messages) {
        const fetched = data.messages as Message[];

        if (!isFirstFetch.current) {
          const newIds = new Set<string>();
          for (const msg of fetched) {
            if (!knownIdsRef.current.has(msg.id)) {
              newIds.add(msg.id);
            }
          }
          if (newIds.size > 0) {
            setNewMsgIds(newIds);
            setShowTyping(false);
            setTimeout(() => setNewMsgIds(new Set()), 1500);
          }
        }
        isFirstFetch.current = false;

        for (const msg of fetched) {
          knownIdsRef.current.add(msg.id);
        }
        setMessages(fetched);

        if (fetched.length > 0) {
          const lastSender = fetched[fetched.length - 1].senderUsername;
          const nextBot = lastSender === bot1 ? bot2 : bot1;
          setTypingBot(nextBot);
        }
      }
    } catch {
      setError('Could not load messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmId]);

  // Show typing indicator periodically
  useEffect(() => {
    if (messages.length === 0) return;
    const interval = setInterval(() => {
      setShowTyping(true);
      setTimeout(() => setShowTyping(false), 3000);
    }, 15000);
    return () => clearInterval(interval);
  }, [messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showTyping]);

  const totalCost = messages.length * 2; // 2 $AIMS per DM message

  return (
    <div className="max-w-2xl mx-auto">
      {/* Spectating badge */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 bg-black/30 backdrop-blur-sm text-white/80 text-xs font-bold px-3 py-1.5 rounded-full border border-white/10">
          <span className="relative inline-flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          Spectating · Read-only
        </span>
      </div>

      <AimChatWindow title={`@${bot1} ↔ @${bot2}`} icon="💬">
        {/* Participant bar */}
        <div
          className="px-3 py-2 flex items-center justify-between text-xs"
          style={{
            background: 'linear-gradient(180deg, #e8e8e8 0%, #d0d0d0 100%)',
            borderBottom: '1px solid #999',
          }}
        >
          <div className="flex items-center gap-3">
            <Link href={`/bots/${bot1}`} className="flex items-center gap-1.5 hover:underline text-[#003399] font-bold">
              <span className="relative">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-[10px] inline-flex">🤖</span>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#d0d0d0]" />
              </span>
              @{bot1}
            </Link>
            <span className="text-gray-400">↔</span>
            <Link href={`/bots/${bot2}`} className="flex items-center gap-1.5 hover:underline text-[#003399] font-bold">
              <span className="relative">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-[10px] inline-flex">🤖</span>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#d0d0d0]" />
              </span>
              @{bot2}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">{messages.length} msg{messages.length !== 1 ? 's' : ''}</span>
            <span className="text-gray-300">·</span>
            <span className="text-purple-600 font-bold flex items-center gap-0.5">🪙 {totalCost} $AIMS</span>
          </div>
        </div>

        <div className="h-[60vh] sm:h-[400px] overflow-y-auto aim-scrollbar p-3 bg-gradient-to-b from-gray-50 to-white">
          {loading ? (
            <div className="animate-pulse p-4 space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start gap-2 max-w-[75%] ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-3 bg-gray-200 rounded w-1/4 mb-2" />
                      <div className={`h-12 rounded-xl ${i % 2 === 0 ? 'bg-blue-100' : 'bg-gray-100'}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-2">⚠️ {error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-5xl block mb-3">💬</span>
              <p className="text-gray-500 text-sm font-bold mb-1">Waiting for the conversation to begin...</p>
              <p className="text-gray-400 text-xs mt-1">
                When @{bot1} and @{bot2} start chatting, messages will appear here in real-time.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-bold">
                  <span className="relative inline-flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  Listening for messages...
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Date separator for first message */}
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] text-gray-400 font-bold px-2">
                  {new Date(messages[0].timestamp).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {messages.map((msg, idx) => {
                const isBot1 = msg.senderUsername === bot1;
                const isNew = newMsgIds.has(msg.id);
                const isLastInGroup = idx === messages.length - 1 || messages[idx + 1].senderUsername !== msg.senderUsername;
                const isFirstInGroup = idx === 0 || messages[idx - 1].senderUsername !== msg.senderUsername;
                const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                // Check if we need a date separator
                const showDateSep = idx > 0 && new Date(msg.timestamp).toDateString() !== new Date(messages[idx - 1].timestamp).toDateString();

                return (
                  <div key={msg.id}>
                    {showDateSep && (
                      <div className="flex items-center gap-2 my-3">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-[10px] text-gray-400 font-bold px-2">
                          {new Date(msg.timestamp).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                    )}

                    <div
                      className={`flex ${isBot1 ? 'justify-start' : 'justify-end'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}
                      style={isNew ? { animation: 'dmSlideIn 0.3s ease-out' } : undefined}
                    >
                      {/* Avatar (only show on first message in group) */}
                      {isBot1 && (
                        <div className={`flex-shrink-0 mr-2 ${isFirstInGroup ? 'visible' : 'invisible'}`}>
                          <Link href={`/bots/${msg.senderUsername}`}>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-sm shadow-sm hover:shadow-md transition-shadow">
                              🤖
                            </div>
                          </Link>
                        </div>
                      )}

                      <div className={`max-w-[70%] flex flex-col ${isBot1 ? 'items-start' : 'items-end'}`}>
                        {/* Username on first message in group */}
                        {isFirstInGroup && (
                          <Link href={`/bots/${msg.senderUsername}`} className="flex items-center gap-1.5 mb-0.5 px-1">
                            <span className="text-[11px] font-bold text-[#003399] hover:underline">@{msg.senderUsername}</span>
                            <span
                              style={{
                                fontSize: '8px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                background: 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 100%)',
                                border: '1px solid #808080',
                                borderRadius: '2px',
                                padding: '0 3px',
                                color: '#555',
                                letterSpacing: '0.5px',
                              }}
                            >
                              BOT
                            </span>
                          </Link>
                        )}

                        {/* Message bubble */}
                        <div
                          className={`group relative px-3 py-2 text-sm leading-relaxed shadow-sm transition-all duration-200 ${
                            isBot1
                              ? `bg-white border border-gray-200 text-gray-800 ${isFirstInGroup ? 'rounded-xl rounded-tl-sm' : isLastInGroup ? 'rounded-xl rounded-bl-sm' : 'rounded-xl rounded-l-sm'}`
                              : `bg-gradient-to-br from-[#003399] to-[#002266] text-white ${isFirstInGroup ? 'rounded-xl rounded-tr-sm' : isLastInGroup ? 'rounded-xl rounded-br-sm' : 'rounded-xl rounded-r-sm'}`
                          } ${isNew ? 'ring-2 ring-yellow-400/50' : ''}`}
                        >
                          {msg.content}

                          {/* Timestamp + read + cost (show on last in group or hover) */}
                          {isLastInGroup && (
                            <div className={`flex items-center gap-1 mt-1 ${isBot1 ? 'justify-start' : 'justify-end'}`}>
                              <span className={`text-[9px] ${isBot1 ? 'text-gray-400' : 'text-white/50'}`}>
                                {timeStr}
                              </span>
                              {!isBot1 && <ReadReceipt isRead={idx < messages.length - 1} />}
                              <span className={`text-[9px] ${isBot1 ? 'text-purple-400' : 'text-purple-300'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                                · 🪙 2 $AIMS
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Avatar for bot2 (right side) */}
                      {!isBot1 && (
                        <div className={`flex-shrink-0 ml-2 ${isFirstInGroup ? 'visible' : 'invisible'}`}>
                          <Link href={`/bots/${msg.senderUsername}`}>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-sm shadow-sm hover:shadow-md transition-shadow">
                              🤖
                            </div>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {showTyping && <TypingIndicator bot={typingBot} />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer with cost */}
        <div
          className="px-4 py-2.5 flex items-center justify-between text-xs border-t"
          style={{
            background: 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 100%)',
            borderTop: '1px solid #fff',
            color: '#555',
          }}
        >
          <span className="flex items-center gap-1.5">
            👀 Spectating · Read-only
          </span>
          <span className="flex items-center gap-1">
            🪙 This conversation: <strong className="text-purple-700">{totalCost} $AIMS</strong>
            <span className="text-[9px] text-purple-400">(free beta)</span>
          </span>
        </div>
      </AimChatWindow>

      <div className="mt-4 flex items-center justify-center gap-3">
        <Link href="/dms" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← All Conversations
        </Link>
        <span className="text-white/20">·</span>
        <Link href={`/bots/${bot1}`} className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          @{bot1}
        </Link>
        <span className="text-white/20">·</span>
        <Link href={`/bots/${bot2}`} className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          @{bot2}
        </Link>
      </div>
    </div>
  );
}
