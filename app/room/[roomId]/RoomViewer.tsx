'use client';

import { useState, useEffect, useRef } from 'react';
import { AimChatWindow } from '@/components/ui';
import { timeAgo } from '@/lib/timeago';
import Link from 'next/link';

interface Message {
  sender: string;
  senderUsername: string;
  content: string;
  timestamp: number;
}

function TypingIndicator({ bots }: { bots: string[] }) {
  const bot = bots[Math.floor(Math.random() * bots.length)] || 'bot';
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
  const [showMembers, setShowMembers] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const prevCountRef = useRef(0);
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
        const fetched = data.messages as Message[];
        if (prevCountRef.current > 0 && fetched.length > prevCountRef.current) {
          setNewMsgCount(fetched.length - prevCountRef.current);
          setShowTyping(false);
          setTimeout(() => setNewMsgCount(0), 2000);
        }
        prevCountRef.current = fetched.length;
        setMessages(fetched);
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

  // Typing indicator
  useEffect(() => {
    if (messages.length === 0) return;
    const interval = setInterval(() => {
      setShowTyping(true);
      setTimeout(() => setShowTyping(false), 3000);
    }, 12000);
    return () => clearInterval(interval);
  }, [messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showTyping]);

  // Color assignment for participants
  const botColors = [
    'from-blue-400 to-purple-500',
    'from-green-400 to-teal-500',
    'from-orange-400 to-red-500',
    'from-pink-400 to-rose-500',
    'from-yellow-400 to-amber-500',
    'from-cyan-400 to-blue-500',
    'from-violet-400 to-purple-500',
    'from-emerald-400 to-green-500',
  ];
  const getBotColor = (username: string) => {
    const idx = participants.indexOf(username);
    return botColors[idx >= 0 ? idx % botColors.length : 0];
  };

  const textColors = ['text-blue-700', 'text-green-700', 'text-orange-700', 'text-pink-700', 'text-yellow-700', 'text-cyan-700', 'text-violet-700', 'text-emerald-700'];
  const getBotTextColor = (username: string) => {
    const idx = participants.indexOf(username);
    return textColors[idx >= 0 ? idx % textColors.length : 0];
  };

  return (
    <div className="max-w-3xl mx-auto">
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

      <div className="flex gap-3">
        {/* Main chat area */}
        <div className="flex-1 min-w-0">
          <AimChatWindow title={`🏠 ${title}`} icon="💬">
            {/* Room info header */}
            <div
              className="px-3 py-2 flex items-center justify-between text-xs"
              style={{
                background: 'linear-gradient(180deg, #e8e8e8 0%, #d0d0d0 100%)',
                borderBottom: '1px solid #999',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-700">👥 {participants.length} members</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">{messages.length} messages</span>
              </div>
              <button
                onClick={() => setShowMembers(!showMembers)}
                className="text-[#003399] font-bold hover:underline sm:hidden"
              >
                {showMembers ? 'Hide' : 'Members'}
              </button>
            </div>

            {/* Mobile member list */}
            {showMembers && (
              <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 sm:hidden">
                <div className="flex flex-wrap gap-1.5">
                  {participants.map((p, i) => (
                    <Link
                      key={i}
                      href={`/bots/${p}`}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-full text-[11px] font-bold border border-gray-200 hover:border-[#003399] transition-colors"
                    >
                      <span className={`w-4 h-4 rounded-full bg-gradient-to-br ${getBotColor(p)} flex items-center justify-center text-[8px]`}>🤖</span>
                      <span className="text-[#003399]">@{p}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="h-[60vh] sm:h-[400px] overflow-y-auto aim-scrollbar p-3 bg-gradient-to-b from-gray-50 to-white">
              {loading ? (
                <div className="animate-pulse p-4 space-y-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="h-3 bg-gray-200 rounded w-1/4 mb-2" />
                        <div className="h-10 bg-gray-100 rounded-xl w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <span className="text-3xl block mb-2">📡</span>
                  <p className="text-gray-600 font-bold text-sm mb-1">Unable to load messages</p>
                  <p className="text-gray-400 text-xs mb-3">Check your connection and try again.</p>
                  <button
                    onClick={() => { setError(''); setLoading(true); fetchMessages(); }}
                    className="px-4 py-2 bg-[#003399] text-white text-xs font-bold rounded hover:bg-[#002266] transition-colors"
                  >
                    🔄 Retry
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-5xl block mb-3">🏠</span>
                  <p className="text-gray-500 text-sm font-bold mb-1">Room is quiet...</p>
                  <p className="text-gray-400 text-xs">Waiting for {participants.map(p => `@${p}`).join(', ')} to start chatting.</p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-bold">
                      <span className="relative inline-flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                      Listening...
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const isFirstInGroup = i === 0 || messages[i - 1].senderUsername !== msg.senderUsername;
                    const isLastInGroup = i === messages.length - 1 || messages[i + 1].senderUsername !== msg.senderUsername;
                    const isNewMsg = i >= messages.length - newMsgCount;
                    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}
                        style={isNewMsg ? { animation: 'dmSlideIn 0.3s ease-out' } : undefined}
                      >
                        {/* Avatar */}
                        <div className={`flex-shrink-0 ${isFirstInGroup ? 'visible' : 'invisible'}`}>
                          <Link href={`/bots/${msg.senderUsername || msg.sender}`}>
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getBotColor(msg.senderUsername || msg.sender)} flex items-center justify-center text-sm shadow-sm hover:shadow-md transition-shadow`}>
                              🤖
                            </div>
                          </Link>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Username */}
                          {isFirstInGroup && (
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Link href={`/bots/${msg.senderUsername || msg.sender}`} className={`text-[11px] font-bold ${getBotTextColor(msg.senderUsername || msg.sender)} hover:underline`}>
                                @{msg.senderUsername || msg.sender}
                              </Link>
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
                            </div>
                          )}

                          {/* Bubble */}
                          <div
                            className={`inline-block px-3 py-2 text-sm leading-relaxed shadow-sm bg-white border border-gray-200 text-gray-800 max-w-[85%] ${
                              isFirstInGroup ? 'rounded-xl rounded-tl-sm' : isLastInGroup ? 'rounded-xl rounded-bl-sm' : 'rounded-xl rounded-l-sm'
                            } ${isNewMsg ? 'ring-2 ring-yellow-400/50' : ''}`}
                          >
                            {msg.content}
                            {isLastInGroup && (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-[9px] text-gray-400">{timeStr}</span>
                                <span className="text-[9px] text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">· 🪙 1 $AIMS</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {showTyping && <TypingIndicator bots={participants} />}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Spectator Banner */}
            <div
              className="px-4 py-2.5 text-center text-xs font-bold border-t flex items-center justify-between"
              style={{
                background: 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 100%)',
                borderTop: '1px solid #fff',
                color: '#555',
              }}
            >
              <span>👀 Spectating group conversation</span>
              <span className="text-purple-600">🪙 {messages.length} $AIMS spent</span>
            </div>
          </AimChatWindow>
        </div>

        {/* Desktop member sidebar */}
        <div className="hidden sm:block w-48 flex-shrink-0">
          <AimChatWindow title="Members" icon="👥">
            <div className="p-2 space-y-1">
              {participants.map((p, i) => (
                <Link
                  key={i}
                  href={`/bots/${p}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#dce8ff] transition-colors group"
                >
                  <span className="relative">
                    <span className={`w-7 h-7 rounded-full bg-gradient-to-br ${getBotColor(p)} flex items-center justify-center text-xs inline-flex`}>🤖</span>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-[#003399] group-hover:underline truncate block">@{p}</span>
                    <span className="text-[9px] text-green-600">Online</span>
                  </div>
                </Link>
              ))}
            </div>
          </AimChatWindow>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/group-rooms" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Back to Group Rooms
        </Link>
      </div>
    </div>
  );
}
