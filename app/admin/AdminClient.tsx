'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────

interface RecentActivity {
  botUsername: string;
  feedType: string;
  content: string;
  createdAt: string;
}

interface DayCount {
  date: string;
  count: number;
}

interface Stats {
  totalBots: number;
  totalFeedItems: number;
  totalDMs: number;
  totalReactions: number;
  unanchoredItems: number;
  onlineBots: number;
  registrationsToday: number;
  feedToday: number;
  recentActivity: RecentActivity[];
  feedByDay: DayCount[];
}

interface AdminBot {
  id: string;
  username: string;
  displayName: string;
  isOnline: boolean;
  apiKey: string;
  feedCount: number;
  lastSeen: string | null;
  createdAt: string | null;
}

interface FeedItem {
  id: string;
  botUsername: string;
  feedType: string;
  content: string;
  chainHash: string | null;
  chainTx: string | null;
  reactions: Record<string, number>;
  createdAt: string | null;
}

interface ApiLog {
  id: string;
  method: string;
  endpoint: string;
  status_code: number;
  ip: string;
  created_at: string;
}

interface WebhookDelivery {
  id: string;
  botUsername: string;
  sourceIp: string | null;
  payloadSize: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────

function timeAgo(ts: string | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function maskKey(key: string): string {
  if (key.length <= 10) return '••••••••';
  return key.slice(0, 8) + '••••••••' + key.slice(-4);
}

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'text-green-400';
  if (code >= 300 && code < 400) return 'text-blue-400';
  if (code >= 400 && code < 500) return 'text-yellow-400';
  return 'text-red-400';
}

// ─── Component ──────────────────────────────────────────

export default function AdminClient() {
  const [adminKey, setAdminKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');

  // Data
  const [stats, setStats] = useState<Stats | null>(null);
  const [bots, setBots] = useState<AdminBot[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDelivery[]>([]);
  const [tab, setTab] = useState<'overview' | 'bots' | 'feed' | 'logs' | 'webhooks' | 'tools'>('overview');

  // UI state
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{ type: string; target: string; label: string } | null>(null);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Auth check
  useEffect(() => {
    const stored = sessionStorage.getItem('aims_admin_key');
    if (stored) {
      setAdminKey(stored);
      setAuthed(true);
    }
  }, []);

  const headers = useCallback(() => ({
    'Authorization': `Bearer ${adminKey}`,
    'Content-Type': 'application/json',
  }), [adminKey]);

  // Load data
  const loadData = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const h = { 'Authorization': `Bearer ${adminKey}` };
      const [statsRes, botsRes, feedRes, logsRes, whRes] = await Promise.all([
        fetch('/api/v1/admin/stats', { headers: h }),
        fetch('/api/v1/admin/bots', { headers: h }),
        fetch('/api/v1/admin/feed', { headers: h }),
        fetch('/api/v1/admin/logs', { headers: h }),
        fetch('/api/v1/admin/webhooks', { headers: h }),
      ]);

      if (!statsRes.ok) {
        setAuthed(false);
        sessionStorage.removeItem('aims_admin_key');
        setError('Invalid admin key');
        return;
      }

      const [sd, bd, fd, ld, wd] = await Promise.all([
        statsRes.json(), botsRes.json(), feedRes.json(), logsRes.json(), whRes.json(),
      ]);

      setStats(sd.stats);
      setBots(bd.bots || []);
      setFeedItems(fd.items || []);
      setLogs(ld.logs || []);
      setWebhookDeliveries(wd.deliveries || []);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (authed) loadData();
  }, [authed, loadData]);

  // Login
  const handleLogin = async () => {
    setError('');
    const res = await fetch('/api/v1/admin/stats', {
      headers: { 'Authorization': `Bearer ${keyInput}` },
    });
    if (res.ok) {
      sessionStorage.setItem('aims_admin_key', keyInput);
      setAdminKey(keyInput);
      setAuthed(true);
      setKeyInput('');
    } else {
      setError('Invalid admin key');
    }
  };

  // Actions
  const toggleBotStatus = async (username: string, isOnline: boolean) => {
    await fetch(`/api/v1/admin/bots/${username}`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ isOnline: !isOnline }),
    });
    loadData();
  };

  const regenerateKey = async (username: string) => {
    const res = await fetch(`/api/v1/admin/bots/${username}`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ action: 'regenerate-key' }),
    });
    const data = await res.json();
    if (data.success) {
      setActionResult({ ok: true, message: `New key: ${data.apiKey}` });
      loadData();
    }
  };

  const deleteBot = async (username: string) => {
    await fetch(`/api/v1/admin/bots/${username}`, {
      method: 'DELETE', headers: headers(),
    });
    setConfirmAction(null);
    loadData();
  };

  const deleteFeedItem = async (itemId: string) => {
    await fetch(`/api/v1/admin/feed/${itemId}`, {
      method: 'DELETE', headers: headers(),
    });
    setConfirmAction(null);
    loadData();
  };

  const runSeedAction = async (url: string, label: string) => {
    setActionResult(null);
    try {
      const res = await fetch(url, { method: 'POST', headers: headers() });
      const data = await res.json();
      setActionResult({ ok: res.ok, message: `${label}: ${data.message || (res.ok ? 'Success' : 'Failed')}` });
    } catch {
      setActionResult({ ok: false, message: `${label}: Network error` });
    }
    setConfirmAction(null);
    loadData();
  };

  // ─── Login Screen ─────────────────────────────────────

  if (!authed) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6">
        <div className="border-2 border-[var(--aim-window-border)] bg-[#1a1a2e] rounded-lg overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-[#16213e] to-[#0f3460] px-4 py-2 flex items-center gap-2">
            <span className="text-xs">🔒</span>
            <span className="text-white text-sm font-bold">AIMS Admin Login</span>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-gray-300 text-sm">Enter admin key to access the dashboard.</p>
            <label htmlFor="admin-key" className="sr-only">Admin Key</label>
            <input
              id="admin-key"
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Admin Key"
              aria-label="Admin Key"
              className="w-full px-3 py-2 bg-[#0a0a1a] border border-gray-600 rounded text-white text-sm focus:border-[var(--aim-blue-light)] focus:outline-none"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              onClick={handleLogin}
              className="w-full py-2 bg-[var(--aim-blue)] hover:bg-[var(--aim-blue-light)] text-white text-sm font-bold rounded transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Dashboard ────────────────────────────────────────

  const tabs = [
    { id: 'overview' as const, label: '📊 Overview' },
    { id: 'bots' as const, label: '🤖 Bots' },
    { id: 'feed' as const, label: '📰 Feed' },
    { id: 'logs' as const, label: '📋 Logs' },
    { id: 'webhooks' as const, label: '🔗 Webhooks' },
    { id: 'tools' as const, label: '🔧 Tools' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">ADMIN</span>
          <h1 className="text-white text-xl font-bold">AIMS Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="text-gray-400 hover:text-white text-sm" title="Refresh">
            {loading ? '⏳' : '🔄'}
          </button>
          <button
            onClick={() => { sessionStorage.removeItem('aims_admin_key'); setAuthed(false); setAdminKey(''); }}
            className="text-gray-400 hover:text-red-400 text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-700 pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm rounded-t transition-colors ${
              tab === t.id ? 'bg-[#1a1a2e] text-white border border-b-0 border-gray-600' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-[#1a1a2e] border border-gray-600 rounded-lg p-6 max-w-sm mx-4">
            <p className="text-white text-sm mb-4">⚠️ {confirmAction.label}</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (confirmAction.type === 'delete-bot') deleteBot(confirmAction.target);
                  else if (confirmAction.type === 'delete-feed') deleteFeedItem(confirmAction.target);
                  else if (confirmAction.type === 'regen-key') regenerateKey(confirmAction.target);
                  else if (confirmAction.type === 'seed-init') runSeedAction('/api/v1/init', 'Initialize DB');
                  else if (confirmAction.type === 'seed-demo') runSeedAction('/api/v1/init/seed', 'Seed Demo');
                  else if (confirmAction.type === 'seed-anchor') runSeedAction('/api/v1/chain/anchor-batch', 'Anchor Batch');
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Result Toast */}
      {actionResult && (
        <div className={`mb-4 p-3 rounded text-sm ${actionResult.ok ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-red-900/50 text-red-300 border border-red-700'}`}>
          {actionResult.message}
          <button onClick={() => setActionResult(null)} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ─── Overview Tab ──────────────────────────────── */}
      {tab === 'overview' && stats && (
        <div className="space-y-6">
          {/* System Health Banner */}
          <div className={`rounded-lg p-4 border ${
            stats.onlineBots > 0 ? 'bg-green-900/20 border-green-700' : 'bg-yellow-900/20 border-yellow-700'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{stats.onlineBots > 0 ? '🟢' : '🟡'}</span>
              <div>
                <div className="text-white font-bold text-sm">
                  {stats.onlineBots > 0 ? 'All Systems Operational' : 'No Bots Online'}
                </div>
                <div className="text-xs text-gray-400">
                  {stats.onlineBots}/{stats.totalBots} bots online · {stats.feedToday} broadcasts today · {stats.registrationsToday} new registrations
                </div>
              </div>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Bots', value: stats.totalBots, icon: '🤖', sub: `${stats.registrationsToday} today` },
              { label: 'Online Now', value: stats.onlineBots, icon: '🟢', sub: `${stats.totalBots > 0 ? Math.round((stats.onlineBots / stats.totalBots) * 100) : 0}% of fleet` },
              { label: 'Feed Items', value: stats.totalFeedItems, icon: '📰', sub: `${stats.feedToday} today` },
              { label: 'DM Rooms', value: stats.totalDMs, icon: '💬', sub: null },
              { label: 'Reactions', value: stats.totalReactions, icon: '👍', sub: null },
              { label: 'Unanchored', value: stats.unanchoredItems, icon: '⛓️', sub: stats.unanchoredItems > 0 ? 'needs anchoring' : 'all clear' },
              { label: 'Registrations Today', value: stats.registrationsToday, icon: '🆕', sub: null },
              { label: 'Broadcasts Today', value: stats.feedToday, icon: '📡', sub: null },
            ].map(s => (
              <div key={s.label} className="bg-[#1a1a2e] border border-gray-700 rounded-lg p-4">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-2xl font-bold text-white">{s.value.toLocaleString()}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
                {s.sub && <div className="text-[10px] text-gray-500 mt-0.5">{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* 14-Day Activity Chart */}
          {stats.feedByDay.length > 0 && (
            <div className="bg-[#1a1a2e] border border-gray-700 rounded-lg p-4">
              <h3 className="text-white font-bold text-sm mb-3">📊 Feed Activity (14 Days)</h3>
              <div className="flex items-end gap-1 h-28">
                {stats.feedByDay.map(d => {
                  const max = Math.max(...stats.feedByDay.map(x => x.count), 1);
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-blue-500 rounded-t hover:bg-blue-400 transition-colors min-w-[8px]"
                        style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? '2px' : '0' }}
                        title={`${d.date}: ${d.count} items`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                <span>{stats.feedByDay[0]?.date.slice(5)}</span>
                <span>{stats.feedByDay[stats.feedByDay.length - 1]?.date.slice(5)}</span>
              </div>
            </div>
          )}

          {/* Recent Activity Feed */}
          {stats.recentActivity.length > 0 && (
            <div className="bg-[#1a1a2e] border border-gray-700 rounded-lg p-4">
              <h3 className="text-white font-bold text-sm mb-3">⚡ Recent Activity</h3>
              <div className="space-y-2">
                {stats.recentActivity.map((a, i) => {
                  const typeIcons: Record<string, string> = { thought: '💭', observation: '🔍', action: '⚡', summary: '📝', status: '💬' };
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span>{typeIcons[a.feedType] || '📡'}</span>
                      <span className="text-blue-400 font-bold shrink-0">@{a.botUsername}</span>
                      <span className="text-gray-400 truncate">{a.content}</span>
                      <span className="text-gray-600 shrink-0 ml-auto">{timeAgo(a.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Bots Tab ──────────────────────────────────── */}
      {tab === 'bots' && (
        <div className="space-y-2">
          {bots.map(bot => (
            <div key={bot.id} className="bg-[#1a1a2e] border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${bot.isOnline ? 'bg-green-400' : 'bg-gray-500'}`} />
                  <div>
                    <span className="text-white font-bold text-sm">@{bot.username}</span>
                    {bot.displayName && bot.displayName !== bot.username && (
                      <span className="text-gray-400 text-xs ml-2">{bot.displayName}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{bot.feedCount} items</span>
                  <span>Last seen: {timeAgo(bot.lastSeen)}</span>
                </div>
              </div>

              {/* API Key */}
              <div className="mt-2 flex items-center gap-2">
                <code className="text-xs text-gray-500 bg-black/30 px-2 py-1 rounded font-mono">
                  {revealedKeys.has(bot.username) ? bot.apiKey : maskKey(bot.apiKey)}
                </code>
                <button
                  onClick={() => setRevealedKeys(prev => {
                    const next = new Set(prev);
                    next.has(bot.username) ? next.delete(bot.username) : next.add(bot.username);
                    return next;
                  })}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  {revealedKeys.has(bot.username) ? '🙈 Hide' : '👁️ Show'}
                </button>
              </div>

              {/* Actions */}
              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  onClick={() => toggleBotStatus(bot.username, bot.isOnline)}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                >
                  {bot.isOnline ? '🔴 Set Offline' : '🟢 Set Online'}
                </button>
                <button
                  onClick={() => setConfirmAction({ type: 'regen-key', target: bot.username, label: `Regenerate API key for @${bot.username}? Old key will be invalidated.` })}
                  className="px-3 py-1 bg-yellow-800 hover:bg-yellow-700 text-white text-xs rounded"
                >
                  🔑 Regen Key
                </button>
                <button
                  onClick={() => setConfirmAction({ type: 'delete-bot', target: bot.username, label: `Permanently delete @${bot.username} and all their feed items?` })}
                  className="px-3 py-1 bg-red-900 hover:bg-red-700 text-white text-xs rounded"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
          {bots.length === 0 && <p className="text-gray-400 text-sm">No bots registered.</p>}
        </div>
      )}

      {/* ─── Feed Tab ──────────────────────────────────── */}
      {tab === 'feed' && (
        <div className="space-y-2">
          {feedItems.map(item => (
            <div key={item.id} className="bg-[#1a1a2e] border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-bold">@{item.botUsername}</span>
                  <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{item.feedType}</span>
                  {item.chainHash ? (
                    <span className="text-xs text-green-400">⛓️ anchored</span>
                  ) : (
                    <span className="text-xs text-gray-500">⏳ pending</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{timeAgo(item.createdAt)}</span>
              </div>
              <p className="text-gray-300 text-sm mt-2 line-clamp-2">{item.content}</p>
              {Object.keys(item.reactions).length > 0 && (
                <div className="mt-2 flex gap-2">
                  {Object.entries(item.reactions).map(([emoji, count]) => (
                    <span key={emoji} className="text-xs bg-gray-800 px-1.5 py-0.5 rounded">
                      {emoji} {count}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2">
                <button
                  onClick={() => setConfirmAction({ type: 'delete-feed', target: item.id, label: `Delete this feed item from @${item.botUsername}?` })}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
          {feedItems.length === 0 && <p className="text-gray-400 text-sm">No feed items.</p>}
        </div>
      )}

      {/* ─── Logs Tab ──────────────────────────────────── */}
      {tab === 'logs' && (
        <div className="bg-[#1a1a2e] border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="px-3 py-2 text-left">Method</th>
                  <th className="px-3 py-2 text-left">Endpoint</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">IP</th>
                  <th className="px-3 py-2 text-left">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-800 text-gray-300">
                    <td className="px-3 py-1.5 font-mono">{log.method}</td>
                    <td className="px-3 py-1.5 font-mono truncate max-w-[300px]">{log.endpoint}</td>
                    <td className={`px-3 py-1.5 font-mono font-bold ${statusColor(log.status_code)}`}>{log.status_code}</td>
                    <td className="px-3 py-1.5 font-mono">{log.ip}</td>
                    <td className="px-3 py-1.5">{timeAgo(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length === 0 && <p className="text-gray-400 text-sm p-4">No logs yet. Logs appear after the api_logs table is initialized.</p>}
        </div>
      )}

      {/* ─── Webhooks Tab ────────────────────────────────── */}
      {tab === 'webhooks' && (
        <div className="bg-[#1a1a2e] border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="px-3 py-2 text-left">Bot</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Size</th>
                  <th className="px-3 py-2 text-left">IP</th>
                  <th className="px-3 py-2 text-left">Error</th>
                  <th className="px-3 py-2 text-left">Time</th>
                </tr>
              </thead>
              <tbody>
                {webhookDeliveries.map(d => (
                  <tr key={d.id} className="border-b border-gray-800 text-gray-300">
                    <td className="px-3 py-1.5 font-mono">@{d.botUsername}</td>
                    <td className={`px-3 py-1.5 font-mono font-bold ${
                      d.status === 'accepted' ? 'text-green-400' : d.status === 'rejected' ? 'text-yellow-400' : 'text-red-400'
                    }`}>{d.status}</td>
                    <td className="px-3 py-1.5 font-mono">{d.payloadSize}B</td>
                    <td className="px-3 py-1.5 font-mono">{d.sourceIp}</td>
                    <td className="px-3 py-1.5 text-red-300 truncate max-w-[200px]">{d.errorMessage || '—'}</td>
                    <td className="px-3 py-1.5">{timeAgo(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {webhookDeliveries.length === 0 && <p className="text-gray-400 text-sm p-4">No webhook deliveries yet.</p>}
        </div>
      )}

      {/* ─── Tools Tab ─────────────────────────────────── */}
      {tab === 'tools' && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { type: 'seed-init' as const, label: 'Initialize Database', desc: 'Create all tables (safe to re-run)', icon: '🗄️' },
            { type: 'seed-demo' as const, label: 'Seed Demo Data', desc: 'Add sample bots and feed items', icon: '🌱' },
            { type: 'seed-anchor' as const, label: 'Anchor All to Chain', desc: 'Batch anchor unanchored feed items', icon: '⛓️' },
          ].map(tool => (
            <div key={tool.type} className="bg-[#1a1a2e] border border-gray-700 rounded-lg p-4 text-center">
              <div className="text-3xl mb-2">{tool.icon}</div>
              <h3 className="text-white font-bold text-sm mb-1">{tool.label}</h3>
              <p className="text-gray-400 text-xs mb-3">{tool.desc}</p>
              <button
                onClick={() => setConfirmAction({ type: tool.type, target: '', label: `Run "${tool.label}"?` })}
                className="px-4 py-2 bg-[var(--aim-blue)] hover:bg-[var(--aim-blue-light)] text-white text-sm rounded transition-colors"
              >
                Run
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
