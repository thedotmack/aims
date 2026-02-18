'use client';

import { useMemo } from 'react';
import Link from 'next/link';

interface Bot {
  username: string;
  displayName: string;
  isOnline: boolean;
  feedCount: number;
}

interface Edge {
  from: string;
  to: string;
  weight: number;
}

export default function NetworkGraph({ bots, edges }: { bots: Bot[]; edges: Edge[] }) {
  const layout = useMemo(() => {
    const n = bots.length;
    if (n === 0) return [];
    const cx = 200, cy = 200, r = Math.min(150, 50 + n * 15);
    return bots.map((bot, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      return {
        ...bot,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        size: Math.max(20, Math.min(40, 15 + bot.feedCount * 0.5)),
      };
    });
  }, [bots]);

  const botMap = useMemo(() => {
    const m: Record<string, (typeof layout)[0]> = {};
    for (const b of layout) m[b.username] = b;
    return m;
  }, [layout]);

  if (bots.length === 0) {
    return <div className="p-8 text-center text-gray-400 text-sm">No bots in the network yet</div>;
  }

  return (
    <div className="relative overflow-hidden" style={{ height: '420px' }}>
      <svg viewBox="0 0 400 400" className="w-full h-full">
        {/* Edges */}
        {edges.map((edge, i) => {
          const from = botMap[edge.from];
          const to = botMap[edge.to];
          if (!from || !to) return null;
          return (
            <line
              key={i}
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke="#c4b5fd"
              strokeWidth={Math.max(1, Math.min(3, edge.weight / 5))}
              strokeOpacity={0.5}
            />
          );
        })}
        {/* Bot nodes */}
        {layout.map((bot) => (
          <Link key={bot.username} href={`/bots/${bot.username}`}>
            <g className="cursor-pointer" style={{ transition: 'transform 0.2s' }}>
              {/* Glow for online */}
              {bot.isOnline && (
                <circle cx={bot.x} cy={bot.y} r={bot.size / 2 + 4} fill="#4CAF50" opacity={0.2}>
                  <animate attributeName="r" values={`${bot.size / 2 + 2};${bot.size / 2 + 6};${bot.size / 2 + 2}`} dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={bot.x} cy={bot.y} r={bot.size / 2}
                fill="url(#botGrad)"
                stroke={bot.isOnline ? '#4CAF50' : '#9ca3af'}
                strokeWidth={2}
              />
              <text
                x={bot.x} y={bot.y + bot.size / 2 + 12}
                textAnchor="middle"
                className="text-[9px] font-bold fill-gray-600"
              >
                @{bot.username.length > 10 ? bot.username.slice(0, 9) + '…' : bot.username}
              </text>
              <text x={bot.x} y={bot.y + 4} textAnchor="middle" className="text-[14px]">
                🤖
              </text>
            </g>
          </Link>
        ))}
        <defs>
          <radialGradient id="botGrad">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </radialGradient>
        </defs>
      </svg>
      <div className="absolute bottom-2 right-2 text-[8px] text-gray-400">
        {bots.length} bots · {edges.length} connections
      </div>
    </div>
  );
}
