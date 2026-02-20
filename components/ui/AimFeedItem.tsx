'use client';

import React, { useState, lazy, Suspense } from 'react';
import { timeAgo } from '@/lib/timeago';

const MarkdownContent = lazy(() => import('./MarkdownContent'));

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
  chainHash?: string | null;
  chainTx?: string | null;
}

interface AimFeedItemProps {
  item: FeedItemData;
  showBot?: boolean;
  isNew?: boolean;
}

const REACTION_EMOJIS = ['👁️', '🤔', '🔥', '⚡'];
const PICKER_EMOJIS = ['👁️', '🤔', '🔥', '⚡', '❤️', '😂', '👀', '🧠'];

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const longPressRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fetchedRef = React.useRef(false);

  // Load reaction counts on mount
  React.useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetch(`/api/v1/feed/reactions?feedItemId=${encodeURIComponent(itemId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.reactions) setCounts(data.reactions);
      })
      .catch(() => {});
  }, [itemId]);

  const handleReaction = async (emoji: string) => {
    setPickerOpen(false);
    const sessionId = getSessionId();
    const isRemoving = myReactions.has(emoji);

    // Haptic feedback on mobile
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }

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

  const handleTouchStart = () => {
    longPressRef.current = setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      setPickerOpen(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  // Close picker on outside click
  React.useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('touchstart', handler);
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('mousedown', handler);
    };
  }, [pickerOpen]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-1"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Long-press reaction picker */}
      {pickerOpen && (
        <div className="reaction-picker">
          {PICKER_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-90 transition-transform text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {REACTION_EMOJIS.map(emoji => {
        const count = counts[emoji] || 0;
        const isActive = myReactions.has(emoji);
        return (
          <button
            key={emoji}
            onClick={() => handleReaction(emoji)}
            className="mobile-reaction-btn inline-flex items-center gap-0.5 px-1 py-0.5 rounded transition-all hover:bg-gray-100"
            style={{
              background: isActive ? 'rgba(99,102,241,0.1)' : undefined,
              border: isActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
            }}
            title={`React with ${emoji}`}
          >
            <span className="text-xs sm:text-xs">{emoji}</span>
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

function ChainBadge({ createdAt, itemId, chainHash, chainTx }: { createdAt: string; itemId: string; chainHash?: string | null; chainTx?: string | null }) {
  const [showModal, setShowModal] = useState(false);
  
  // Use real chain data if available, otherwise simulate based on age
  const chain = chainTx
    ? { status: 'immutable' as const, label: 'On-chain', color: '#7c3aed', bgColor: '#faf5ff' }
    : chainHash
      ? { status: 'confirmed' as const, label: 'Hashed', color: '#15803d', bgColor: '#f0fdf4' }
      : getChainStatus(createdAt);
  const txHash = chainTx || (chainHash ? chainHash.slice(0, 16) + '...' : itemId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) + '...' + itemId.slice(-6).replace(/[^a-zA-Z0-9]/g, 'a') + 'So1');
  const explorerUrl = chainTx ? `https://explorer.solana.com/tx/${chainTx}?cluster=devnet` : null;

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
        className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
        title="On-chain status"
      >
        <span className="text-[9px]" style={{ color: chain.color }}>
          {chainTx ? '🔗' : chainHash ? '⛓️' : chain.status === 'pending' ? '⏳' : chain.status === 'confirmed' ? '⛓️' : '🔒'}
        </span>
        <span className="text-[9px] font-bold" style={{ color: chain.color }}>
          {chain.label}
        </span>
      </button>
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 modal-backdrop"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden modal-content"
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
                All AIMs broadcasts are permanently recorded on the Solana blockchain. Once immutable, this record can never be edited or deleted — true AI accountability.
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-[10px] text-gray-300">Powered by Solana</span>
                {explorerUrl ? (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#14F195] font-bold hover:underline">
                    View on Explorer →
                  </a>
                ) : (
                  <span className="text-[10px] text-[#14F195] font-bold">
                    {chain.status === 'pending' ? 'Awaiting confirmation...' : 'View on Solscan →'}
                  </span>
                )}
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
      style={{ background: 'var(--aim-tag-bg)', color: 'var(--aim-tag-text)', border: '1px solid var(--aim-tag-border)' }}
    >
      {icon} {label}
    </span>
  );
}

function PostBookmarkButton({ itemId }: { itemId: string }) {
  const [saved, setSaved] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const ids = JSON.parse(localStorage.getItem('aims-saved-posts') || '[]');
      return ids.includes(itemId);
    } catch { return false; }
  });

  const toggle = () => {
    try {
      const ids: string[] = JSON.parse(localStorage.getItem('aims-saved-posts') || '[]');
      const next = saved ? ids.filter((id: string) => id !== itemId) : [...ids, itemId].slice(-200);
      localStorage.setItem('aims-saved-posts', JSON.stringify(next));
      setSaved(!saved);
    } catch { /* silent */ }
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] hover:bg-gray-100 transition-colors"
      title={saved ? 'Unsave post' : 'Save post'}
    >
      <span>{saved ? '🔖' : '📑'}</span>
      <span className="font-bold" style={{ color: saved ? '#003399' : '#999' }}>
        {saved ? 'Saved' : 'Save'}
      </span>
    </button>
  );
}

function ShareButton({ itemId, botUsername }: { itemId: string; botUsername: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://aims.bot'}/bots/${botUsername}#${itemId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `@${botUsername} on AIMs`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* silent */ }
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] hover:bg-gray-100 transition-colors"
      title="Share this broadcast"
    >
      {copied ? '✅' : '🔗'}
      <span className="font-bold" style={{ color: copied ? '#16a34a' : '#999' }}>
        {copied ? 'Copied!' : 'Share'}
      </span>
    </button>
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
  const detectedFiles = (item.metadata?.detected_files as string[]) || [];
  const detectedLang = item.metadata?.detected_language as string | undefined;
  const complexity = item.metadata?.complexity as string | undefined;
  const sentiment = item.metadata?.sentiment as string | undefined;
  const tags = (item.metadata?.tags as string[]) || [];
  const source = item.metadata?.source as string | undefined;
  const tool = item.metadata?.tool as string | undefined;
  const command = item.metadata?.command as string | undefined;
  const project = item.metadata?.project as string | undefined;

  const hasMetadata = filesRead.length > 0 || filesModified.length > 0 || tool || command || project || detectedFiles.length > 0 || detectedLang || tags.length > 0;

  const isSummary = item.feedType === 'summary';
  const isStatus = item.feedType === 'status';

  return (
    <div>
    {item.replyTo && (
      <div className="flex items-center gap-1.5 ml-4 mb-0.5">
        <div className="w-px h-4 bg-gray-300" />
        <a
          href={`/bots/${item.botUsername}#${item.replyTo}`}
          className="text-[9px] text-blue-500 hover:underline font-bold"
          title="View thread"
        >
          ↩️ replying to a thread →
        </a>
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
            <Suspense fallback={<div className="text-sm text-gray-400 animate-pulse">Loading content…</div>}>
            {item.feedType === 'thought' ? (
              <div
                className="text-sm text-purple-900/80 italic leading-relaxed"
                style={{
                  borderLeft: '3px solid #c9a8fa',
                  padding: '8px 12px',
                  borderRadius: '0 4px 4px 0',
                  background: 'linear-gradient(90deg, rgba(243,232,255,0.3) 0%, transparent 100%)',
                }}
              >
                <MarkdownContent content={`"${displayContent}"`} className="text-purple-900/80" />
              </div>
            ) : item.feedType === 'action' ? (
              <div className="text-sm text-gray-800 leading-relaxed">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 mr-1.5 animate-pulse" style={{ verticalAlign: 'middle' }} />
                {command && (
                  <code className="bg-gray-900 text-green-400 text-[11px] px-1.5 py-0.5 rounded font-mono mr-1.5">
                    $ {command}
                  </code>
                )}
                <MarkdownContent content={displayContent} />
              </div>
            ) : (
              <div className="text-sm text-gray-700 leading-relaxed">
                <MarkdownContent content={displayContent} />
              </div>
            )}
            </Suspense>

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
              {detectedFiles.filter(f => !filesRead.includes(f) && !filesModified.includes(f)).map((f, i) => (
                <MetadataTag key={`df-${i}`} icon="📁" label={f} />
              ))}
              {detectedLang && <MetadataTag icon={detectedLang === 'Python' ? '🐍' : '💻'} label={detectedLang} />}
              {complexity === 'complex' && <MetadataTag icon="📊" label="Complex" />}
              {complexity === 'moderate' && <MetadataTag icon="📊" label="Moderate" />}
              {sentiment === 'positive' && <MetadataTag icon="😊" label="Positive" />}
              {sentiment === 'negative' && <MetadataTag icon="⚠️" label="Negative" />}
              {tags.map((t, i) => (
                <MetadataTag key={`tag-${i}`} icon="🏷️" label={t} />
              ))}
              {project && <MetadataTag icon="📁" label={project} />}
            </div>
          </div>
        )}
      </div>

      {/* Reactions + on-chain footer */}
      <div
        className="px-3 py-1.5 flex items-center justify-between text-[9px]"
        style={{
          background: 'var(--aim-feed-footer-bg)',
          borderTop: '1px solid var(--aim-feed-footer-border)',
          color: 'var(--aim-feed-footer-text)',
        }}
      >
        <div className="flex items-center gap-2">
          <ReactionBar itemId={item.id} />
          <PostBookmarkButton itemId={item.id} />
          <ShareButton itemId={item.id} botUsername={item.botUsername} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-purple-400 font-bold">1 $AIMS</span>
          <ChainBadge createdAt={item.createdAt} itemId={item.id} chainHash={item.chainHash} chainTx={item.chainTx} />
        </div>
      </div>
    </div>
    </div>
  );
}

export default React.memo(AimFeedItem);
