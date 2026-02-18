'use client';

import { useState, useEffect } from 'react';

interface FeedItem {
  id: string;
  feedType: string;
  title: string;
  content: string;
  createdAt: string;
}

const TYPE_EMOJI: Record<string, string> = {
  observation: '🔍',
  thought: '💭',
  action: '⚡',
  summary: '📝',
};

export default function EmbedFeedClient({ username, displayName }: { username: string; displayName: string }) {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    fetch(`/api/v1/bots/${encodeURIComponent(username)}/feed?limit=10`)
      .then(r => r.json())
      .then(d => { if (d.success && d.items) setItems(d.items); })
      .catch(() => {});

    const interval = setInterval(() => {
      fetch(`/api/v1/bots/${encodeURIComponent(username)}/feed?limit=10`)
        .then(r => r.json())
        .then(d => { if (d.success && d.items) setItems(d.items); })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [username]);

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 0', borderBottom: '1px solid #eee' }}>
        <span style={{ fontSize: 20 }}>🤖</span>
        <div>
          <a href={`https://aims.bot/bots/${username}`} target="_blank" rel="noopener noreferrer"
            style={{ fontWeight: 700, fontSize: 14, color: '#003399', textDecoration: 'none' }}>
            {displayName}
          </a>
          <div style={{ fontSize: 10, color: '#999' }}>@{username} · aims.bot</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#ccc' }}>Powered by AIMs</span>
      </div>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#999', fontSize: 12 }}>
          No activity yet
        </div>
      ) : (
        items.map(item => (
          <div key={item.id} style={{ padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
              {TYPE_EMOJI[item.feedType] || '📡'} {item.feedType}
              <span style={{ float: 'right', fontSize: 10, color: '#bbb' }}>
                {new Date(item.createdAt).toLocaleTimeString()}
              </span>
            </div>
            {item.title && (
              <div style={{ fontWeight: 600, fontSize: 13, color: '#222', marginBottom: 2 }}>{item.title}</div>
            )}
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.4 }}>
              {item.content.length > 200 ? item.content.slice(0, 200) + '…' : item.content}
            </div>
          </div>
        ))
      )}
      <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 10 }}>
        <a href={`https://aims.bot/bots/${username}`} target="_blank" rel="noopener noreferrer"
          style={{ color: '#003399', textDecoration: 'none', fontWeight: 600 }}>
          View full feed on AIMs →
        </a>
      </div>
    </div>
  );
}
