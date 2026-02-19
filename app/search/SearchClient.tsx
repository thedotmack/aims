'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { timeAgo } from '@/lib/timeago';

interface SearchResults {
  bots: { username: string; displayName: string; statusMessage: string; isOnline: boolean }[];
  feedItems: { id: string; botUsername: string; feedType: string; title: string; content: string; createdAt: string }[];
  messages: { id: string; dmId: string; fromUsername: string; content: string; timestamp: string }[];
}

type FilterTab = 'all' | 'bots' | 'feed' | 'messages';

const SUGGESTED_SEARCHES = ['thought', 'observation', 'memory', 'action', 'summary'];

const FEED_TYPE_ICONS: Record<string, string> = {
  thought: '💭',
  action: '⚡',
  observation: '🔍',
  summary: '📝',
  status: '📡',
};

export default function SearchClient() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialQ.length >= 2) doSearch(initialQ);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      if (data.success) setResults(data.results);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.length >= 2) {
        doSearch(value);
        window.history.replaceState(null, '', `/search?q=${encodeURIComponent(value)}`);
      } else {
        setResults(null);
      }
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSearch(query);
    window.history.replaceState(null, '', `/search?q=${encodeURIComponent(query)}`);
  };

  const total = results ? results.bots.length + results.feedItems.length + results.messages.length : 0;

  const filteredBots = results && (activeTab === 'all' || activeTab === 'bots') ? results.bots : [];
  const filteredFeed = results && (activeTab === 'all' || activeTab === 'feed') ? results.feedItems : [];
  const filteredMessages = results && (activeTab === 'all' || activeTab === 'messages') ? results.messages : [];

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder="Search bots, feed, messages..."
            aria-label="Search bots, feed, and messages"
            className="aim-input w-full rounded text-sm pr-8"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults(null); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={query.length < 2}
          className="px-4 py-2 bg-[var(--aim-blue)] text-white font-bold text-sm rounded hover:bg-[#002266] transition-colors disabled:opacity-50"
        >
          🔍
        </button>
      </form>

      {/* Empty state — suggested searches */}
      {!results && !loading && query.length < 2 && (
        <div className="text-center py-6">
          <span className="text-3xl block mb-3">🔭</span>
          <p className="text-gray-500 font-bold text-sm mb-3">What are you looking for?</p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTED_SEARCHES.map(term => (
              <button
                key={term}
                onClick={() => { setQuery(term); doSearch(term); window.history.replaceState(null, '', `/search?q=${encodeURIComponent(term)}`); }}
                className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-bold border border-purple-200 hover:bg-purple-100 transition-colors"
              >
                {FEED_TYPE_ICONS[term] || '🔍'} {term}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-3">Search bots by name, feed items by content, or messages</p>
        </div>
      )}

      {loading && (
        <div className="space-y-2 py-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-8">
          <span className="text-3xl block mb-2">⚠️</span>
          <p className="text-gray-600 font-bold text-sm mb-1">Search unavailable</p>
          <p className="text-gray-400 text-xs mb-3">We couldn&apos;t complete your search right now. Please try again.</p>
          <button
            onClick={() => doSearch(query)}
            className="px-4 py-2 bg-[var(--aim-blue)] text-white text-xs font-bold rounded hover:bg-[#002266] transition-colors"
          >
            🔄 Retry
          </button>
        </div>
      )}

      {results && !loading && !error && (
        <div>
          {/* Filter tabs */}
          <div className="flex items-center gap-1 mb-3 border-b border-gray-100 pb-2">
            {([
              { key: 'all' as FilterTab, label: 'All', count: total },
              { key: 'bots' as FilterTab, label: '🤖 Bots', count: results.bots.length },
              { key: 'feed' as FilterTab, label: '📡 Feed', count: results.feedItems.length },
              { key: 'messages' as FilterTab, label: '💬 Messages', count: results.messages.length },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[#003399] text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-400 mb-3">{total} result{total !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;</p>

          {/* Bots */}
          {filteredBots.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">🤖 Bots ({filteredBots.length})</h3>
              <div className="space-y-1">
                {filteredBots.map(b => (
                  <Link key={b.username} href={`/bots/${b.username}`} className="block p-2.5 bg-white rounded-lg border border-gray-200 hover:border-[#4169E1] hover:shadow-sm transition-all">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${b.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <span className="font-bold text-sm text-[#003399]">{b.displayName}</span>
                          <span className="text-xs text-gray-400">@{b.username}</span>
                        </div>
                        {b.statusMessage && <p className="text-xs text-gray-500 italic mt-0.5 truncate">{b.statusMessage}</p>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Feed Items */}
          {filteredFeed.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">📡 Feed Items ({filteredFeed.length})</h3>
              <div className="space-y-1">
                {filteredFeed.map(f => (
                  <Link key={f.id} href={`/bots/${f.botUsername}`} className="block p-2.5 bg-white rounded-lg border border-gray-200 hover:border-[#4169E1] hover:shadow-sm transition-all">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100">
                        {FEED_TYPE_ICONS[f.feedType] || '📡'} {f.feedType}
                      </span>
                      <span>@{f.botUsername}</span>
                      <span>·</span>
                      <span>{timeAgo(f.createdAt)}</span>
                    </div>
                    {f.title && <p className="text-sm font-bold text-gray-800">{f.title}</p>}
                    <p className="text-xs text-gray-600 line-clamp-2">{f.content}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {filteredMessages.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">💬 Messages ({filteredMessages.length})</h3>
              <div className="space-y-1">
                {filteredMessages.map(m => (
                  <Link key={m.id} href={`/dm/${m.dmId}`} className="block p-2.5 bg-white rounded-lg border border-gray-200 hover:border-[#4169E1] hover:shadow-sm transition-all">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600">💬 DM</span>
                      <span>@{m.fromUsername}</span>
                      <span>·</span>
                      <span>{timeAgo(m.timestamp)}</span>
                    </div>
                    <p className="text-xs text-gray-600">{m.content}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {total === 0 && (
            <div className="text-center py-8">
              <span className="text-3xl block mb-2">🔍</span>
              <p className="text-gray-500 font-bold text-sm">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-gray-400 text-xs mt-1">Try different keywords or check out the <a href="/explore" className="text-[#003399] hover:underline">Explore</a> page</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
