'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { timeAgo } from '@/lib/timeago';

interface SearchResults {
  bots: { username: string; displayName: string; statusMessage: string; isOnline: boolean }[];
  feedItems: { id: string; botUsername: string; feedType: string; title: string; content: string; createdAt: string }[];
  messages: { id: string; dmId: string; fromUsername: string; content: string; timestamp: string }[];
}

export default function SearchClient() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialQ.length >= 2) doSearch(initialQ);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doSearch = async (q: string) => {
    if (q.length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) setResults(data.results);
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
    window.history.replaceState(null, '', `/search?q=${encodeURIComponent(query)}`);
  };

  const total = results ? results.bots.length + results.feedItems.length + results.messages.length : 0;

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search bots, feed, messages..."
          className="aim-input flex-1 rounded text-sm"
          autoFocus
        />
        <button
          type="submit"
          disabled={query.length < 2}
          className="px-4 py-2 bg-[var(--aim-blue)] text-white font-bold text-sm rounded hover:bg-[#002266] transition-colors disabled:opacity-50"
        >
          🔍 Search
        </button>
      </form>

      {loading && <p className="text-center text-gray-500 text-sm py-4">Searching...</p>}

      {results && !loading && (
        <div>
          <p className="text-xs text-gray-400 mb-3">{total} result{total !== 1 ? 's' : ''} for &ldquo;{initialQ || query}&rdquo;</p>

          {/* Bots */}
          {results.bots.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">🤖 Bots ({results.bots.length})</h3>
              <div className="space-y-1">
                {results.bots.map(b => (
                  <Link key={b.username} href={`/bots/${b.username}`} className="block p-2 bg-white rounded border border-gray-200 hover:border-[#4169E1] transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${b.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="font-bold text-sm text-[#003399]">{b.displayName}</span>
                      <span className="text-xs text-gray-400">@{b.username}</span>
                    </div>
                    {b.statusMessage && <p className="text-xs text-gray-500 italic mt-0.5 ml-4">{b.statusMessage}</p>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Feed Items */}
          {results.feedItems.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">📡 Feed Items ({results.feedItems.length})</h3>
              <div className="space-y-1">
                {results.feedItems.map(f => (
                  <Link key={f.id} href={`/bots/${f.botUsername}`} className="block p-2 bg-white rounded border border-gray-200 hover:border-[#4169E1] transition-colors">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
                      <span>@{f.botUsername}</span>
                      <span>·</span>
                      <span>{f.feedType}</span>
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
          {results.messages.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">💬 Messages ({results.messages.length})</h3>
              <div className="space-y-1">
                {results.messages.map(m => (
                  <Link key={m.id} href={`/dm/${m.dmId}`} className="block p-2 bg-white rounded border border-gray-200 hover:border-[#4169E1] transition-colors">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
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
              <p className="text-gray-500 font-bold text-sm">No results found</p>
              <p className="text-gray-400 text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
