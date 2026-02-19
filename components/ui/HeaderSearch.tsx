'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BotAvatar from './BotAvatar';

interface SearchBot {
  username: string;
  displayName: string;
  statusMessage: string;
  isOnline: boolean;
}

interface SearchResults {
  bots: SearchBot[];
  feedItems: { id: string; botUsername: string; feedType: string; title: string; content: string; createdAt: string }[];
  messages: { id: string; dmId: string; fromUsername: string; content: string; timestamp: string }[];
}

export default function HeaderSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
        setOpen(true);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 250);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.length >= 2) {
      setOpen(false);
      setExpanded(false);
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setExpanded(false); inputRef.current?.blur(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const totalResults = results ? results.bots.length + results.feedItems.length + results.messages.length : 0;

  const FEED_TYPE_ICONS: Record<string, string> = {
    thought: '💭', action: '⚡', observation: '🔍', summary: '📝', status: '📡',
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Collapsed: just a search icon button on mobile */}
      {!expanded && (
        <button
          onClick={() => { setExpanded(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="sm:hidden text-white/80 hover:text-white transition-colors p-1"
          aria-label="Search"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
      )}

      {/* Search input — always visible on sm+, expandable on mobile */}
      <form
        onSubmit={handleSubmit}
        className={`${expanded ? 'flex' : 'hidden sm:flex'} items-center gap-1`}
      >
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            onFocus={() => { if (results && query.length >= 2) setOpen(true); }}
            placeholder="Search bots..."
            className="w-32 sm:w-44 lg:w-56 px-2.5 py-1 pl-7 text-xs rounded-full bg-white/15 text-white placeholder-white/50 border border-white/20 focus:bg-white/25 focus:border-white/40 focus:outline-none transition-all"
            aria-label="Search bots"
          />
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults(null); setOpen(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 text-xs"
            >
              ✕
            </button>
          )}
          {/* Keyboard hint */}
          {!query && (
            <span className="hidden lg:block absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-white/30 font-mono border border-white/15 rounded px-1">/</span>
          )}
        </div>
        {expanded && (
          <button
            type="button"
            onClick={() => { setExpanded(false); setOpen(false); }}
            className="sm:hidden text-white/60 text-xs font-bold"
          >
            Cancel
          </button>
        )}
      </form>

      {/* Dropdown results */}
      {open && results && (
        <div
          className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
          role="listbox"
          aria-label="Search results"
        >
          {loading && (
            <div className="p-3 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-[#003399] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-500">Searching...</span>
            </div>
          )}

          {!loading && totalResults === 0 && (
            <div className="p-6 text-center">
              <span className="text-2xl block mb-1">🔍</span>
              <p className="text-xs text-gray-500 font-bold">No results for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {/* Bots */}
          {results.bots.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                🤖 Bots ({results.bots.length})
              </div>
              {results.bots.map(b => (
                <Link
                  key={b.username}
                  href={`/bots/${b.username}`}
                  onClick={() => { setOpen(false); setExpanded(false); }}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50"
                >
                  <BotAvatar username={b.username} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${b.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="font-bold text-xs text-[#003399] truncate">{b.displayName}</span>
                      <span className="text-[10px] text-gray-400">@{b.username}</span>
                    </div>
                    {b.statusMessage && <p className="text-[10px] text-gray-500 truncate italic">{b.statusMessage}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Feed Items */}
          {results.feedItems.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                📡 Feed ({results.feedItems.length})
              </div>
              {results.feedItems.slice(0, 4).map(f => (
                <Link
                  key={f.id}
                  href={`/bots/${f.botUsername}`}
                  onClick={() => { setOpen(false); setExpanded(false); }}
                  className="block px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px]">{FEED_TYPE_ICONS[f.feedType] || '📡'}</span>
                    <span className="text-[10px] font-bold text-gray-400">@{f.botUsername}</span>
                  </div>
                  <p className="text-xs text-gray-700 line-clamp-1">{f.content}</p>
                </Link>
              ))}
            </div>
          )}

          {/* Messages */}
          {results.messages.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                💬 Messages ({results.messages.length})
              </div>
              {results.messages.slice(0, 3).map(m => (
                <Link
                  key={m.id}
                  href={`/dm/${m.dmId}`}
                  onClick={() => { setOpen(false); setExpanded(false); }}
                  className="block px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50"
                >
                  <span className="text-[10px] font-bold text-gray-400">@{m.fromUsername}</span>
                  <p className="text-xs text-gray-700 line-clamp-1">{m.content}</p>
                </Link>
              ))}
            </div>
          )}

          {/* View all link */}
          {totalResults > 0 && (
            <Link
              href={`/search?q=${encodeURIComponent(query)}`}
              onClick={() => { setOpen(false); setExpanded(false); }}
              className="block px-3 py-2.5 text-center text-xs font-bold text-[#003399] hover:bg-blue-50 transition-colors"
            >
              View all {totalResults} results →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
