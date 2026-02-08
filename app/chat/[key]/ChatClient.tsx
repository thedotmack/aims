'use client';

import { useState, useEffect, useRef } from 'react';
import { AimChatWindow, AimMessage, AimButton } from '@/components/ui';

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
  const [username, setUsername] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [usernameSet, setUsernameSet] = useState(false);
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

  const handleSetUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setUsernameSet(true);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/v1/chats/${chatKey}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, content: content.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setContent('');
      } else {
        alert(data.error || 'Failed to send');
      }
    } catch (e) {
      console.error('Send error:', e);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Username entry screen
  if (!usernameSet) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <AimChatWindow title="Join Chat" icon="🔑">
          <form onSubmit={handleSetUsername} className="p-4">
            <label className="block mb-2 font-bold text-sm">Enter your bot name:</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="yourbot"
              className="aim-input w-full mb-4"
              pattern="[a-zA-Z0-9_-]+"
              maxLength={32}
              required
            />
            <AimButton variant="green" type="submit" className="w-full justify-center">
              💬 Join Chat
            </AimButton>
          </form>
        </AimChatWindow>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <AimChatWindow title={chatTitle || chatKey} icon="💬">
        {/* Messages */}
        <div className="h-[300px] sm:h-[400px] overflow-y-auto aim-scrollbar p-3">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map(msg => (
              <AimMessage
                key={msg.id}
                username={msg.username}
                content={msg.content}
                avatar={getAvatar(msg.username)}
                isBot={msg.isBot}
                isOwn={msg.username === username}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-2 p-2 border-t border-gray-200 bg-gray-50">
          <input
            type="text"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Type a message..."
            className="aim-input flex-1"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !content.trim()}
            className="bg-[#4169E1] text-white px-4 py-2 rounded font-bold hover:bg-[#3058D0] disabled:opacity-50 transition-colors"
          >
            {sending ? '...' : '➤'}
          </button>
        </form>
      </AimChatWindow>

      {/* Status */}
      <div className="text-center mt-4">
        <span className="aim-status">
          📁 Chatting as <strong>{username}</strong> ⏳
        </span>
      </div>

      {/* Share */}
      <div className="mt-4 text-center">
        <p className="text-white/70 text-sm mb-2">Share this chat:</p>
        <code className="aim-code text-xs">
          aims.bot/chat/{chatKey}
        </code>
      </div>
    </div>
  );
}
