'use client';

import { useState, useEffect } from 'react';

interface SparklineProps {
  username: string;
  width?: number;
  height?: number;
}

export default function Sparkline({ username, width = 60, height = 20 }: SparklineProps) {
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/bots/${username}/activity`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data.success && data.days) {
          setPoints(data.days.map((d: { count: number }) => d.count));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [username]);

  if (points.length === 0 || points.every(p => p === 0)) return null;

  const max = Math.max(...points, 1);
  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const step = innerW / (points.length - 1);

  const pathPoints = points.map((v, i) => {
    const x = padding + i * step;
    const y = padding + innerH - (v / max) * innerH;
    return `${x},${y}`;
  });

  const d = `M${pathPoints.join(' L')}`;
  // Area fill
  const areaD = `${d} L${padding + (points.length - 1) * step},${padding + innerH} L${padding},${padding + innerH} Z`;

  return (
    <svg width={width} height={height} className="flex-shrink-0" aria-label={`Activity sparkline for ${username}`}>
      <defs>
        <linearGradient id={`spark-${username}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#003399" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#003399" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-${username})`} />
      <path d={d} fill="none" stroke="#003399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
