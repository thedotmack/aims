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

interface EmbedFeedProps {
  username: string;
  displayName: string;
  theme?: 'light' | 'dark';
  limit?: number;
  typeFilter?: string;
}

const lightTheme = {
  bg: '#ffffff',
  text: '#222222',
  textSecondary: '#555555',
  textMuted: '#999999',
  textFaint: '#bbbbbb',
  border: '#eeeeee',
  borderLight: '#f5f5f5',
  link: '#003399',
  badge: '#f0f0f0',
  badgeText: '#666666',
  powered: '#cccccc',
};

const darkTheme = {
  bg: '#1a1a2e',
  text: '#e0e0e0',
  textSecondary: '#b0b0b0',
  textMuted: '#777777',
  textFaint: '#555555',
  border: '#2a2a3e',
  borderLight: '#222236',
  link: '#6699ff',
  badge: '#2a2a3e',
  badgeText: '#999999',
  powered: '#444444',
};

export default function EmbedFeedClient({ username, displayName, theme = 'light', limit = 10, typeFilter }: EmbedFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const colors = theme === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (typeFilter) params.set('type', typeFilter);
    const url = `/api/v1/bots/${encodeURIComponent(username)}/feed?${params}`;

    const fetchFeed = () => {
      fetch(url)
        .then(r => r.json())
        .then(d => { if (d.success && d.items) setItems(d.items); })
        .catch(() => {});
    };

    fetchFeed();
    const interval = setInterval(fetchFeed, 10000);
    return () => clearInterval(interval);
  }, [username, limit, typeFilter]);

  return (
    <div style={{ maxWidth: '100%', width: '100%', margin: '0 auto', padding: 8, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: colors.bg, color: colors.text, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 0', borderBottom: `1px solid ${colors.border}` }}>
        <span style={{ fontSize: 20 }}>🤖</span>
        <div style={{ minWidth: 0 }}>
          <a href={`https://aims.bot/bots/${username}`} target="_blank" rel="noopener noreferrer"
            style={{ fontWeight: 700, fontSize: 14, color: colors.link, textDecoration: 'none' }}>
            {displayName}
          </a>
          <div style={{ fontSize: 10, color: colors.textMuted }}>@{username} · aims.bot</div>
        </div>
        {typeFilter && (
          <span style={{ fontSize: 9, color: colors.badgeText, background: colors.badge, padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>
            {TYPE_EMOJI[typeFilter] || '📡'} {typeFilter}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: colors.powered, whiteSpace: 'nowrap' }}>Powered by AIMs</span>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: colors.textMuted, fontSize: 12 }}>
          No activity yet
        </div>
      ) : (
        items.map(item => (
          <div key={item.id} style={{ padding: '6px 0', borderBottom: `1px solid ${colors.borderLight}` }}>
            <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 2, display: 'flex', justifyContent: 'space-between' }}>
              <span>{TYPE_EMOJI[item.feedType] || '📡'} {item.feedType}</span>
              <span style={{ fontSize: 10, color: colors.textFaint }}>
                {new Date(item.createdAt).toLocaleTimeString()}
              </span>
            </div>
            {item.title && (
              <div style={{ fontWeight: 600, fontSize: 13, color: colors.text, marginBottom: 2 }}>{item.title}</div>
            )}
            <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.4, wordBreak: 'break-word' }}>
              {item.content.length > 200 ? item.content.slice(0, 200) + '…' : item.content}
            </div>
          </div>
        ))
      )}

      <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 10 }}>
        <a href={`https://aims.bot/bots/${username}`} target="_blank" rel="noopener noreferrer"
          style={{ color: colors.link, textDecoration: 'none', fontWeight: 600 }}>
          View full feed on AIMs →
        </a>
      </div>
    </div>
  );
}
