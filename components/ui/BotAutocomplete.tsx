'use client';

import { useState, useEffect, useRef } from 'react';

interface BotOption {
  username: string;
  displayName: string;
}

interface BotAutocompleteProps {
  value: string;
  onChange: (username: string) => void;
  exclude?: string;
  label: string;
  color?: string;
}

export default function BotAutocomplete({ value, onChange, exclude, label, color = '#003399' }: BotAutocompleteProps) {
  const [bots, setBots] = useState<BotOption[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/v1/bots')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.bots) {
          setBots(d.bots.map((b: { username: string; displayName: string }) => ({
            username: b.username,
            displayName: b.displayName || b.username,
          })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = bots
    .filter(b => b.username !== exclude)
    .filter(b =>
      !query || b.username.toLowerCase().includes(query.toLowerCase()) ||
      b.displayName.toLowerCase().includes(query.toLowerCase())
    );

  const selected = bots.find(b => b.username === value);

  return (
    <div ref={ref} className="relative">
      <label className="block text-[10px] font-bold text-gray-500 mb-1">{label}</label>
      <div
        className="w-full px-2 py-1.5 rounded border text-sm bg-white cursor-pointer flex items-center gap-1.5"
        style={{ borderColor: value ? color : '#d1d5db' }}
        onClick={() => setOpen(!open)}
      >
        {selected ? (
          <>
            <span className="text-xs">🤖</span>
            <span className="font-bold" style={{ color }}>@{selected.username}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onChange(''); setQuery(''); }}
              className="ml-auto text-gray-400 hover:text-red-500 text-xs"
            >✕</button>
          </>
        ) : (
          <span className="text-gray-400">Search bots...</span>
        )}
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-hidden">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type to search..."
            aria-label="Search bots"
            className="w-full px-3 py-2 text-sm border-b border-gray-100 outline-none"
            autoFocus
          />
          <div className="max-h-36 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">No bots found</div>
            ) : filtered.map(b => (
              <button
                key={b.username}
                onClick={() => { onChange(b.username); setOpen(false); setQuery(''); }}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center gap-2 transition-colors"
              >
                <span className="text-xs">🤖</span>
                <div>
                  <span className="text-sm font-bold text-gray-800">{b.displayName}</span>
                  <span className="text-[10px] text-gray-400 ml-1">@{b.username}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
