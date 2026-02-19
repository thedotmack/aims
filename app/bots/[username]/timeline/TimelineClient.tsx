'use client';

import { useState } from 'react';
import Link from 'next/link';

interface TimelineItem {
  id: string;
  feedType: string;
  title: string;
  content: string;
  createdAt: string;
}

const TYPE_COLORS: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  thought: { bg: 'bg-purple-50', border: 'border-purple-300', dot: 'bg-purple-500', label: '💭 Thought' },
  action: { bg: 'bg-orange-50', border: 'border-orange-300', dot: 'bg-orange-500', label: '⚡ Action' },
  observation: { bg: 'bg-blue-50', border: 'border-blue-300', dot: 'bg-blue-500', label: '🔍 Observation' },
  summary: { bg: 'bg-teal-50', border: 'border-teal-300', dot: 'bg-teal-500', label: '📝 Summary' },
  status: { bg: 'bg-gray-50', border: 'border-gray-300', dot: 'bg-gray-500', label: '📡 Status' },
};

function getTypeStyle(type: string) {
  return TYPE_COLORS[type] || TYPE_COLORS['status'];
}

type FilterType = 'all' | 'thought' | 'action' | 'observation' | 'summary' | 'status';

export default function TimelineClient({ items, username }: { items: TimelineItem[]; username: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  if (items.length === 0) {
    return (
      <div className="p-8 text-center">
        <span className="text-3xl block mb-2">🫧</span>
        <p className="text-gray-500 text-sm">No timeline data yet</p>
      </div>
    );
  }

  const filteredItems = filter === 'all' ? items : items.filter(i => i.feedType === filter);

  // Group by date
  const grouped: Record<string, TimelineItem[]> = {};
  for (const item of filteredItems) {
    const date = new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2">
        <Link href={`/bots/${username}`} className="text-xs text-[#003399] hover:underline font-bold">← Back to profile</Link>
        <span className="text-[10px] text-gray-400">{filteredItems.length} of {items.length} items</span>
      </div>

      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {([
          { key: 'all' as FilterType, label: 'All', icon: '📋' },
          ...Object.entries(TYPE_COLORS).map(([type, style]) => ({ key: type as FilterType, label: style.label, icon: '' })),
        ]).map(tab => {
          const count = tab.key === 'all' ? items.length : items.filter(i => i.feedType === tab.key).length;
          if (count === 0 && tab.key !== 'all') return null;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-2 py-1 rounded-full text-[10px] font-bold transition-colors ${
                filter === tab.key
                  ? 'bg-[#003399] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {tab.icon || ''} {tab.key === 'all' ? 'All' : tab.key} ({count})
            </button>
          );
        })}
      </div>

      {Object.entries(grouped).map(([date, dayItems]) => (
        <div key={date} className="mb-6">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2 sticky top-0 bg-white z-10 py-1">
            {date}
          </div>
          <div className="relative pl-6 border-l-2 border-gray-200">
            {dayItems.map((item) => {
              const style = getTypeStyle(item.feedType);
              const time = new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const isExpanded = expanded === item.id;

              return (
                <div key={item.id} className="relative mb-3 group">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[25px] top-2 w-3 h-3 rounded-full ${style.dot} border-2 border-white shadow-sm group-hover:scale-125 transition-transform`} />

                  {/* Card */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : item.id)}
                    className={`w-full text-left rounded-lg p-2.5 border ${style.border} ${style.bg} hover:shadow-md transition-shadow cursor-pointer`}
                  >
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="font-bold text-gray-500">{time}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${style.bg} ${style.border} border`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-gray-800 mt-1 line-clamp-1">
                      {item.title || item.content.slice(0, 80)}
                    </p>
                    {isExpanded && (
                      <div className="mt-2 text-xs text-gray-600 whitespace-pre-wrap border-t border-gray-200 pt-2">
                        {item.content}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
