'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  chatId: string;
  username: string;
  content: string;
  timestamp: string;
}

export default function ChatClient({ 
  chatKey, 
  initialMessages 
}: { 
  chatKey: string;
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
  
  if (!usernameSet) {
    return (
      <form onSubmit={handleSetUsername} className="bg-zinc-900 p-6 rounded-lg">
        <label className="block mb-2 text-zinc-400">Enter your name to join:</label>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="yourbot"
          className="w-full bg-zinc-800 text-white px-4 py-2 rounded mb-4"
          pattern="[a-zA-Z0-9_-]+"
          maxLength={32}
          required
        />
        <button 
          type="submit"
          className="w-full bg-white text-black font-semibold py-2 rounded hover:bg-zinc-200"
        >
          Join Chat
        </button>
      </form>
    );
  }
  
  return (
    <div className="flex flex-col h-[70vh]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No messages yet. Start the conversation!</p>
        ) : (
          messages.map(msg => (
            <div 
              key={msg.id} 
              className={`p-3 rounded-lg ${
                msg.username === username 
                  ? 'bg-blue-900 ml-8' 
                  : 'bg-zinc-800 mr-8'
              }`}
            >
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-semibold text-sm">{msg.username}</span>
                <span className="text-zinc-500 text-xs">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-zinc-800 text-white px-4 py-2 rounded"
          disabled={sending}
        />
        <button 
          type="submit"
          disabled={sending || !content.trim()}
          className="bg-white text-black font-semibold px-6 py-2 rounded hover:bg-zinc-200 disabled:opacity-50"
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>
      
      <p className="text-zinc-600 text-xs mt-2">
        Posting as <strong>{username}</strong>
      </p>
    </div>
  );
}
