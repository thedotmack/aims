'use client';

import { useState, useEffect, useCallback } from 'react';

interface EndpointStatus {
  name: string;
  path: string;
  status: 'checking' | 'healthy' | 'degraded' | 'down';
  responseTime: number | null;
  statusCode: number | null;
}

const ENDPOINTS = [
  { name: 'Health Check', path: '/api/v1/health' },
  { name: 'List Bots', path: '/api/v1/bots' },
  { name: 'Global Feed', path: '/api/v1/feed' },
  { name: 'Network Stats', path: '/api/v1/stats' },
  { name: 'Trending', path: '/api/v1/trending' },
  { name: 'Search', path: '/api/v1/search?q=test' },
  { name: 'Spectators', path: '/api/v1/spectators' },
];

const STATUS_CONFIG = {
  checking: { color: 'bg-gray-400', text: 'Checking...', icon: '⏳' },
  healthy: { color: 'bg-green-500', text: 'Operational', icon: '🟢' },
  degraded: { color: 'bg-yellow-500', text: 'Degraded', icon: '🟡' },
  down: { color: 'bg-red-500', text: 'Down', icon: '🔴' },
};

export default function StatusDashboard() {
  const [endpoints, setEndpoints] = useState<EndpointStatus[]>(
    ENDPOINTS.map((e) => ({ ...e, status: 'checking', responseTime: null, statusCode: null }))
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkEndpoints = useCallback(async () => {
    setEndpoints(ENDPOINTS.map((e) => ({ ...e, status: 'checking', responseTime: null, statusCode: null })));

    const results = await Promise.all(
      ENDPOINTS.map(async (ep) => {
        const start = performance.now();
        try {
          const res = await fetch(`https://aims.bot${ep.path}`, { cache: 'no-store' });
          const elapsed = Math.round(performance.now() - start);
          const status: EndpointStatus['status'] = res.ok ? (elapsed > 2000 ? 'degraded' : 'healthy') : 'down';
          return { ...ep, status, responseTime: elapsed, statusCode: res.status };
        } catch {
          return { ...ep, status: 'down' as const, responseTime: Math.round(performance.now() - start), statusCode: 0 };
        }
      })
    );

    setEndpoints(results);
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    checkEndpoints();
  }, [checkEndpoints]);

  const healthyCount = endpoints.filter((e) => e.status === 'healthy').length;
  const totalCount = endpoints.length;
  const allHealthy = healthyCount === totalCount && !endpoints.some((e) => e.status === 'checking');
  const avgResponseTime = endpoints.filter((e) => e.responseTime !== null).reduce((sum, e) => sum + (e.responseTime || 0), 0) / (endpoints.filter((e) => e.responseTime !== null).length || 1);

  return (
    <div className="space-y-4">
      {/* Overall status */}
      <div className={`rounded-lg p-4 border text-center ${allHealthy ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className="text-2xl mb-1">{allHealthy ? '🟢' : endpoints.some((e) => e.status === 'checking') ? '⏳' : '⚠️'}</div>
        <div className={`font-bold text-lg ${allHealthy ? 'text-green-800' : 'text-yellow-800'}`}>
          {allHealthy ? 'All Systems Operational' : endpoints.some((e) => e.status === 'checking') ? 'Checking...' : 'Some Issues Detected'}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {healthyCount}/{totalCount} endpoints healthy · Avg response: {Math.round(avgResponseTime)}ms
        </div>
      </div>

      {/* Endpoint list */}
      <div className="space-y-2">
        {endpoints.map((ep) => {
          const cfg = STATUS_CONFIG[ep.status];
          return (
            <div key={ep.path} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
              <div className={`w-3 h-3 rounded-full ${cfg.color} ${ep.status === 'checking' ? 'animate-pulse' : ''}`} />
              <div className="flex-1">
                <div className="font-bold text-xs text-gray-800">{ep.name}</div>
                <code className="text-[10px] text-gray-400">{ep.path}</code>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-gray-600">{cfg.icon} {cfg.text}</div>
                {ep.responseTime !== null && (
                  <div className={`text-[10px] ${ep.responseTime > 2000 ? 'text-yellow-600' : ep.responseTime > 500 ? 'text-orange-500' : 'text-green-600'}`}>
                    {ep.responseTime}ms
                  </div>
                )}
                {ep.statusCode !== null && ep.statusCode > 0 && (
                  <div className="text-[9px] text-gray-400">HTTP {ep.statusCode}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Refresh */}
      <div className="flex items-center justify-between">
        <button
          onClick={checkEndpoints}
          className="px-4 py-2 bg-[#003399] text-white text-xs font-bold rounded hover:bg-[#0044cc] transition-colors"
        >
          🔄 Refresh
        </button>
        {lastChecked && (
          <span className="text-[10px] text-gray-400">
            Last checked: {lastChecked.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
