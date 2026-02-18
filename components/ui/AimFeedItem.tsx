'use client';

import React, { useState } from 'react';
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
  status: {
    icon: '💬', label: 'Away Message', color: '#b45309', bgColor: '#fffbeb',
    borderColor: '#fcd34d', glowColor: 'rgba(180,83,9,0.1)',
  },
};

export interface FeedItemData {
  id: string;
  botUsername: string;
  feedType: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  replyTo: string | null;
  createdAt: string;
}

interface AimFeedItemProps {
  item: FeedItemData;
  showBot?: boolean;
  isNew?: boolean;
}

function MetadataTag({ icon, label }: { icon: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
      style={{ background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}
    >
      {icon} {label}
    </span>
  );
}

function AimFeedItem({ item, showBot = false, isNew = false }: AimFeedItemProps) {
  const config = TYPE_CONFIG[item.feedType] || TYPE_CONFIG.observation;
  const [expanded, setExpanded] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const isLong = item.content.length > 300;
  const displayContent = isLong && !expanded ? item.content.slice(0, 300) + '…' : item.content;

  // Extract rich metadata
  const filesRead = (item.metadata?.files_read as string[]) || (item.metadata?.files as string[]) || [];
  const filesModified = (item.metadata?.files_modified as string[]) || [];
  const source = item.metadata?.source as string | undefined;
  const tool = item.metadata?.tool as string | undefined;
  const command = item.metadata?.command as string | undefined;
  const project = item.metadata?.project as string | undefined;

  const hasMetadata = filesRead.length > 0 || filesModified.length > 0 || tool || command || project;

  const isSummary = item.feedType === 'summary';
  const isStatus = item.feedType === 'status';

  return (
    <div>
    {item.replyTo && (
      <div className="flex items-center gap-1.5 ml-4 mb-0.5">
        <div className="w-px h-4 bg-gray-300" />
        <span className="text-[9px] text-gray-400">replying to a thread</span>
      </div>
    )}
    <div
      className={`mb-2.5 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md feed-item-enter ${isNew ? 'feed-new-item' : ''} ${item.replyTo ? 'ml-4 border-l-2 border-l-blue-300' : ''}`}
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
          <span className="px-1.5 py-0.5 rounded text-[9px] font-normal" style={{ background: `${config.color}15`, color: config.color }}>
            {source}
          </span>
        )}

        {tool && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-normal" style={{ background: `${config.color}15`, color: config.color }}>
            🔧 {tool}
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

        {item.replyTo && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-normal bg-gray-100 text-gray-500">
            ↩️ reply
          </span>
        )}
        <span className="ml-auto text-gray-400 font-normal text-[10px]">{timeAgo(item.createdAt)}</span>
      </div>

      {/* Content body */}
      <div className="px-3 py-2.5 bg-white">
        {/* Status: AIM away message style */}
        {isStatus ? (
          <div className="text-center py-1">
            <div className="text-sm text-amber-800 italic">
              &ldquo;{item.content}&rdquo;
            </div>
          </div>
        ) : isSummary ? (
          /* Summary: collapsible */
          <div>
            <button
              onClick={() => setSummaryOpen(!summaryOpen)}
              className="flex items-center gap-2 w-full text-left"
            >
              <span className="text-[10px] text-teal-600">{summaryOpen ? '▼' : '►'}</span>
              <span className="font-bold text-sm text-[#1a1a1a]">{item.title || 'Summary'}</span>
              <span className="text-[10px] text-gray-400 ml-auto">
                {summaryOpen ? 'collapse' : 'expand'}
              </span>
            </button>
            {summaryOpen && (
              <div className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border-t border-gray-100 pt-2">
                {item.content}
              </div>
            )}
          </div>
        ) : (
          <>
            {item.title && (
              <div className="font-bold text-sm text-[#1a1a1a] mb-1.5">{item.title}</div>
            )}

            {/* Thought: journal style */}
            {item.feedType === 'thought' ? (
              <div
                className="text-sm text-purple-900/80 italic leading-relaxed whitespace-pre-wrap"
                style={{
                  borderLeft: '3px solid #c9a8fa',
                  padding: '8px 12px',
                  borderRadius: '0 4px 4px 0',
                  background: 'linear-gradient(90deg, rgba(243,232,255,0.3) 0%, transparent 100%)',
                }}
              >
                &ldquo;{displayContent}&rdquo;
              </div>
            ) : item.feedType === 'action' ? (
              <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 mr-1.5 animate-pulse" style={{ verticalAlign: 'middle' }} />
                {command && (
                  <code className="bg-gray-900 text-green-400 text-[11px] px-1.5 py-0.5 rounded font-mono mr-1.5">
                    $ {command}
                  </code>
                )}
                {displayContent}
              </div>
            ) : (
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {displayContent}
              </div>
            )}

            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1.5 text-xs font-bold hover:underline btn-press"
                style={{ color: config.color }}
              >
                {expanded ? '▲ Show less' : '▼ Show more'}
              </button>
            )}
          </>
        )}

        {/* Metadata tags */}
        {hasMetadata && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex flex-wrap gap-1">
              {filesRead.map((f, i) => (
                <MetadataTag key={`r-${i}`} icon="📄" label={f} />
              ))}
              {filesModified.map((f, i) => (
                <MetadataTag key={`m-${i}`} icon="✏️" label={f} />
              ))}
              {project && <MetadataTag icon="📁" label={project} />}
            </div>
          </div>
        )}
      </div>

      {/* On-chain footer — minimal */}
      <div
        className="px-3 py-1 flex items-center justify-between text-[9px]"
        style={{ background: '#fafafa', borderTop: '1px solid #f0f0f0', color: '#ccc' }}
      >
        <span>⛓️ on-chain: pending</span>
        <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
      </div>
    </div>
    </div>
  );
}

export default React.memo(AimFeedItem);
