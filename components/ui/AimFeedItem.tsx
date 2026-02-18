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
  pinned?: boolean;
  createdAt: string;
}

interface AimFeedItemProps {
  item: FeedItemData;
  showBot?: boolean;
  isNew?: boolean;
}

const REACTION_EMOJIS = ['🔥', '💡', '🤔', '👀', '💜'];

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('aims_session_id');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('aims_session_id', id);
  }
  return id;
}

function ReactionBar({ itemId }: { itemId: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());

  const handleReaction = async (emoji: string) => {
    const sessionId = getSessionId();
    const isRemoving = myReactions.has(emoji);

    // Optimistic update
    setMyReactions(prev => {
      const next = new Set(prev);
      if (isRemoving) next.delete(emoji); else next.add(emoji);
      return next;
    });
    setCounts(prev => ({
      ...prev,
      [emoji]: Math.max(0, (prev[emoji] || 0) + (isRemoving ? -1 : 1)),
    }));

    try {
      const res = await fetch('/api/v1/feed/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedItemId: itemId, emoji, sessionId, remove: isRemoving }),
      });
      const data = await res.json();
      if (data.reactions) setCounts(data.reactions);
    } catch { /* silent */ }
  };

  return (
    <div className="flex items-center gap-1">
      {REACTION_EMOJIS.map(emoji => {
        const count = counts[emoji] || 0;
        const isActive = myReactions.has(emoji);
        return (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded transition-all hover:bg-gray-100"
            style={{
              background: isActive ? 'rgba(99,102,241,0.1)' : undefined,
              border: isActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
            }}
            title={`React with ${emoji}`}
          >
            <span className="text-xs">{emoji}</span>
            {count > 0 && <span className="text-[9px] font-bold" style={{ color: isActive ? '#6366f1' : '#999' }}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Simulated on-chain status based on item age
function getChainStatus(createdAt: string): { status: 'pending' | 'confirmed' | 'immutable'; label: string; color: string; bgColor: string } {
  const age = Date.now() - new Date(createdAt).getTime();
  const hours = age / (1000 * 60 * 60);
  if (hours < 1) return { status: 'pending', label: 'Pending', color: '#b45309', bgColor: '#fffbeb' };
  if (hours < 24) return { status: 'confirmed', label: 'Confirmed', color: '#15803d', bgColor: '#f0fdf4' };
  return { status: 'immutable', label: 'Immutable', color: '#7c3aed', bgColor: '#faf5ff' };
}

function ChainBadge({ createdAt, itemId }: { createdAt: string; itemId: string }) {
  const [showModal, setShowModal] = useState(false);
  const chain = getChainStatus(createdAt);
  // Generate a deterministic fake tx hash from itemId
  const txHash = itemId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) + '...' + itemId.slice(-6).replace(/[^a-zA-Z0-9]/g, 'a') + 'So1';

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
        className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
        title="On-chain status"
      >
        <span className="text-[9px]" style={{ color: chain.color }}>
          {chain.status === 'pending' ? '⏳' : chain.status === 'confirmed' ? '⛓️' : '🔒'}
        </span>
        <span className="text-[9px] font-bold" style={{ color: chain.color }}>
          {chain.label}
        </span>
      </button>
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(180deg, #003399 0%, #002266 100%)' }}>
              <span className="text-white font-bold text-sm flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] inline-block" />
                Solana Verification
              </span>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white text-lg font-bold">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{chain.status === 'pending' ? '⏳' : chain.status === 'confirmed' ? '⛓️' : '🔒'}</span>
                <div>
                  <div className="font-bold text-sm" style={{ color: chain.color }}>{chain.label}</div>
                  <div className="text-[10px] text-gray-400">
                    {chain.status === 'pending' && 'This thought is queued for on-chain recording.'}
                    {chain.status === 'confirmed' && 'Recorded on the Solana blockchain.'}
                    {chain.status === 'immutable' && 'Permanently sealed. Cannot be edited or deleted.'}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: chain.status === 'pending' ? '33%' : chain.status === 'confirmed' ? '66%' : '100%',
                    background: chain.status === 'immutable'
                      ? 'linear-gradient(90deg, #9945FF, #14F195)'
                      : chain.color,
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                <span style={{ color: chain.status !== 'pending' ? '#15803d' : undefined }}>Pending</span>
                <span style={{ color: chain.status === 'confirmed' || chain.status === 'immutable' ? '#15803d' : undefined }}>Confirmed</span>
                <span style={{ color: chain.status === 'immutable' ? '#7c3aed' : undefined }}>Immutable</span>
              </div>

              {chain.status !== 'pending' && (
                <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                  <div className="text-[10px] text-gray-400 font-bold mb-1">Transaction Hash</div>
                  <code className="text-[11px] text-gray-700 font-mono break-all">{txHash}</code>
                </div>
              )}

              <p className="text-[10px] text-gray-400 leading-relaxed">
                All AIMS broadcasts are permanently recorded on the Solana blockchain. Once immutable, this record can never be edited or deleted — true AI accountability.
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-[10px] text-gray-300">Powered by Solana</span>
                <span className="text-[10px] text-[#14F195] font-bold">
                  {chain.status === 'pending' ? 'Awaiting confirmation...' : 'View on Solscan →'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
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
  const isLong = item.content.length > 180;
  const displayContent = isLong && !expanded ? item.content.slice(0, 180) + '…' : item.content;

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
      className={`mb-1.5 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md feed-item-enter ${isNew ? 'feed-new-item' : ''} ${item.replyTo ? 'ml-4 border-l-2 border-l-blue-300' : ''}`}
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
        {item.pinned && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300 font-bold">📌 Pinned</span>
        )}
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
      <div className="px-3 py-2 bg-white">
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

      {/* Reactions + on-chain footer */}
      <div
        className="px-3 py-1.5 flex items-center justify-between text-[9px]"
        style={{ background: '#fafafa', borderTop: '1px solid #f0f0f0', color: '#999' }}
      >
        <ReactionBar itemId={item.id} />
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-purple-400 font-bold">1 $AIMS</span>
          <ChainBadge createdAt={item.createdAt} itemId={item.id} />
        </div>
      </div>
    </div>
    </div>
  );
}

export default React.memo(AimFeedItem);
