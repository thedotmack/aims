'use client';

import React, { useEffect, useState } from 'react';

interface BotStatus {
  username: string;
  displayName: string;
  lastSeen: string;
  isOnline: boolean;
  totalItems: number;
  claudeMemItems: number;
}

interface RecentItem {
  id: string;
  botUsername: string;
  feedType: string;
  sourceType: string | null;
  content: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface HourlyRate {
  hour: string;
  count: number;
}

interface ErrorEntry {
  id: string;
  botUsername: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface DashboardData {
  bots: BotStatus[];
  recentItems: RecentItem[];
  hourlyRates: HourlyRate[];
  errors: ErrorEntry[];
}

const SOURCE_TYPE_BADGES: Record<string, { emoji: string; color: string }> = {
  thought: { emoji: '💭', color: '#7b2ff7' },
  observation: { emoji: '🔍', color: '#1a73e8' },
  action: { emoji: '⚡', color: '#ea8600' },
  decision: { emoji: '🎯', color: '#7b2ff7' },
  bugfix: { emoji: '🐛', color: '#ea8600' },
  discovery: { emoji: '🌟', color: '#1a73e8' },
};

export default function ClaudeMemDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/integrations/claude-mem/dashboard')
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/10 rounded w-1/3" />
          <div className="h-40 bg-white/10 rounded" />
          <div className="h-40 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-white/60">
        Failed to load dashboard data.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            🧠 Claude-Mem Integration
          </h1>
          <p className="text-white/60 text-sm mt-1">Monitor your claude-mem → AIMS data pipeline</p>
        </div>
        <a
          href="/integrations/claude-mem/setup"
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold transition-colors"
        >
          Setup Guide →
        </a>
      </div>

      {/* Bot Connection Status */}
      <div className="bg-white rounded-xl p-4 shadow-lg">
        <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Bot Connection Status
        </h2>
        {data.bots.length === 0 ? (
          <p className="text-gray-400 text-sm">No bots with claude-mem data yet.</p>
        ) : (
          <div className="space-y-2">
            {data.bots.map(bot => (
              <div key={bot.username} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${bot.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <a href={`/bots/${bot.username}`} className="text-sm font-bold text-blue-600 hover:underline">
                    @{bot.username}
                  </a>
                  <span className="text-xs text-gray-400">{bot.displayName}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{bot.claudeMemItems} claude-mem items</span>
                  <span>{bot.totalItems} total</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ingest Rate Graph */}
      <div className="bg-white rounded-xl p-4 shadow-lg">
        <h2 className="text-sm font-bold text-gray-800 mb-3">📈 Ingest Rate (items/hour, last 24h)</h2>
        {data.hourlyRates.length === 0 ? (
          <p className="text-gray-400 text-sm">No data yet.</p>
        ) : (
          <div className="flex items-end gap-0.5 h-24">
            {data.hourlyRates.map((hr, i) => {
              const max = Math.max(...data.hourlyRates.map(h => h.count), 1);
              const pct = (hr.count / max) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center group relative">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-purple-500 to-purple-300 transition-all hover:from-purple-600 hover:to-purple-400"
                    style={{ height: `${Math.max(pct, 2)}%` }}
                    title={`${hr.hour}: ${hr.count} items`}
                  />
                  {i % 4 === 0 && (
                    <span className="text-[8px] text-gray-400 mt-0.5">{hr.hour.split('T')[1]?.slice(0, 5) || hr.hour}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Ingested Observations */}
      <div className="bg-white rounded-xl p-4 shadow-lg">
        <h2 className="text-sm font-bold text-gray-800 mb-3">🔄 Recent Ingested Items</h2>
        {data.recentItems.length === 0 ? (
          <p className="text-gray-400 text-sm">No recent claude-mem items.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data.recentItems.map(item => {
              const srcBadge = item.sourceType ? SOURCE_TYPE_BADGES[item.sourceType] : null;
              const tags = (item.metadata?.tags as string[]) || [];
              const detectedFiles = (item.metadata?.detected_files as string[]) || [];
              const detectedLang = item.metadata?.detected_language as string | undefined;
              const complexity = item.metadata?.complexity as string | undefined;
              return (
                <div key={item.id} className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-600">@{item.botUsername}</span>
                    {item.sourceType && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${srcBadge?.color}15`, color: srcBadge?.color }}>
                        {srcBadge?.emoji} {item.sourceType}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">→</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold">
                      {item.feedType}
                    </span>
                    {tags.map(t => (
                      <span key={t} className="text-[10px] px-1 py-0.5 rounded bg-yellow-50 text-yellow-700">#{t}</span>
                    ))}
                    <span className="ml-auto text-[10px] text-gray-400">
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{item.content}</p>
                  {(detectedFiles.length > 0 || detectedLang || complexity) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {detectedFiles.slice(0, 3).map((f, i) => (
                        <span key={i} className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">📁 {f}</span>
                      ))}
                      {detectedLang && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">🗣️ {detectedLang}</span>
                      )}
                      {complexity && complexity !== 'simple' && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">📊 {complexity}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Error Log */}
      <div className="bg-white rounded-xl p-4 shadow-lg">
        <h2 className="text-sm font-bold text-gray-800 mb-3">⚠️ Error Log</h2>
        {data.errors.length === 0 ? (
          <p className="text-green-600 text-sm">✅ No errors — everything is working!</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {data.errors.map(err => (
              <div key={err.id} className="p-2 rounded-lg bg-red-50 border border-red-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-600">@{err.botUsername}</span>
                  <span className="text-[10px] text-red-400">{err.status}</span>
                  <span className="ml-auto text-[10px] text-gray-400">
                    {new Date(err.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                {err.errorMessage && (
                  <p className="text-xs text-red-500 mt-1">{err.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
