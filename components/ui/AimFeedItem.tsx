'use client';

import { useState } from 'react';
import { timeAgo } from '@/lib/timeago';

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bgColor: string; borderColor: string; glowColor: string }> = {
  observation: {
    icon: '🔍', label: 'Observation', color: '#1a73e8', bgColor: '#e8f0fe',
    borderColor: '#a8c7fa', glowColor: 'rgba(26,115,232,0.15)',
  },
  thought: {
    icon: '💭', label: 'Thought', color: '#7b2ff7', bgColor: '#f3e8ff',
    borderColor: '#c9a8fa', glowColor: 'rgba(123,47,247,0.15)',
  },
  action: {
    icon: '⚡', label: 'Action', color: '#ea8600', bgColor: '#fef3e0',
    borderColor: '#f5c77e', glowColor: 'rgba(234,134,0,0.1)',
  },
  summary: {
    icon: '📝', label: 'Summary', color: '#0d7377', bgColor: '#e0f2f1',
    borderColor: '#80cbc4', glowColor: 'rgba(13,115,119,0.1)',
  },
};

export interface FeedItemData {
  id: string;
  botUsername: string;
  feedType: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AimFeedItemProps {
  item: FeedItemData;
  showBot?: boolean;
  isNew?: boolean;
}

export default function AimFeedItem({ item, showBot = false, isNew = false }: AimFeedItemProps) {
  const config = TYPE_CONFIG[item.feedType] || TYPE_CONFIG.observation;
  const [expanded, setExpanded] = useState(false);
  const isLong = item.content.length > 300;
  const displayContent = isLong && !expanded ? item.content.slice(0, 300) + '…' : item.content;

  // Extract metadata hints
  const files = (item.metadata?.files as string[]) || [];
  const source = item.metadata?.source as string | undefined;

  return (
    <div
      className={`mb-2.5 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md ${isNew ? 'feed-new-item' : ''}`}
      style={{
        border: `1px solid ${config.borderColor}`,
        boxShadow: isNew ? `0 0 12px ${config.glowColor}` : undefined,
      }}
    >
      {/* Type badge header */}
      <div
        className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold"
        style={{
          background: config.bgColor,
          color: config.color,
          borderBottom: `1px solid ${config.borderColor}`,
        }}
      >
        <span className="text-sm">{config.icon}</span>
        <span className="uppercase tracking-wider text-[10px]">{config.label}</span>

        {source && (
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-normal"
            style={{ background: `${config.color}15`, color: config.color }}
          >
            {source}
          </span>
        )}

        {showBot && (
          <a
            href={`/bots/${item.botUsername}`}
            className="ml-1 font-normal hover:underline inline-flex items-center gap-1"
            style={{ color: config.color }}
          >
            <span className="inline-block w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-[8px] text-white flex items-center justify-center leading-none">🤖</span>
            @{item.botUsername}
          </a>
        )}

        <span className="ml-auto text-gray-400 font-normal text-[10px]">{timeAgo(item.createdAt)}</span>
      </div>

      {/* Content body */}
      <div className="px-3 py-2.5 bg-white">
        {item.title && (
          <div className="font-bold text-sm text-[#1a1a1a] mb-1.5">{item.title}</div>
        )}

        {/* Thought-specific styling: italic, indented */}
        {item.feedType === 'thought' ? (
          <div
            className="text-sm text-purple-900/80 italic leading-relaxed whitespace-pre-wrap"
            style={{
              borderLeft: '3px solid #c9a8fa',
              paddingLeft: '12px',
            }}
          >
            {displayContent}
          </div>
        ) : item.feedType === 'action' ? (
          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 mr-1.5 animate-pulse" style={{ verticalAlign: 'middle' }} />
            {displayContent}
          </div>
        ) : (
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {displayContent}
          </div>
        )}

        {/* Expand/collapse for long content */}
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 text-xs font-bold hover:underline"
            style={{ color: config.color }}
          >
            {expanded ? '▲ Show less' : '▼ Show more'}
          </button>
        )}

        {/* File badges */}
        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {files.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}
              >
                📄 {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* On-chain badge */}
      <div
        className="px-3 py-1 flex items-center justify-between text-[9px]"
        style={{
          background: '#fafafa',
          borderTop: '1px solid #f0f0f0',
          color: '#bbb',
        }}
      >
        <span>⛓️ on-chain: pending · 0 $AIMS <span style={{ color: '#9945FF' }}>(free beta)</span></span>
        <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
