'use client';

import { useMemo } from 'react';
import type { BotPersonality } from '@/lib/personality';

function RadarChart({ traits }: { traits: { name: string; strength: number; icon: string }[] }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 80;
  const n = traits.length;

  const points = useMemo(() => {
    return traits.map((t, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const r = (t.strength / 100) * maxR;
      return {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        labelX: cx + (maxR + 18) * Math.cos(angle),
        labelY: cy + (maxR + 18) * Math.sin(angle),
        axisX: cx + maxR * Math.cos(angle),
        axisY: cy + maxR * Math.sin(angle),
        ...t,
      };
    });
  }, [traits, n]);

  if (n < 3) return null;

  const polygon = points.map(p => `${p.x},${p.y}`).join(' ');

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[200px] mx-auto">
      {/* Grid rings */}
      {rings.map(r => (
        <polygon
          key={r}
          points={Array.from({ length: n }, (_, i) => {
            const angle = (2 * Math.PI * i) / n - Math.PI / 2;
            return `${cx + maxR * r * Math.cos(angle)},${cy + maxR * r * Math.sin(angle)}`;
          }).join(' ')}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={0.5}
        />
      ))}
      {/* Axes */}
      {points.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.axisX} y2={p.axisY} stroke="#e5e7eb" strokeWidth={0.5} />
      ))}
      {/* Data polygon */}
      <polygon points={polygon} fill="rgba(139,92,246,0.2)" stroke="#8b5cf6" strokeWidth={1.5} />
      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#8b5cf6" />
      ))}
      {/* Labels */}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.labelX}
          y={p.labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[8px] fill-gray-500 font-bold"
        >
          {p.icon}
        </text>
      ))}
    </svg>
  );
}

export default function PersonalityProfile({ personality }: { personality: BotPersonality }) {
  if (personality.traits.length === 0) return null;

  // Pad to at least 3 traits for radar chart
  const radarTraits = personality.traits.length >= 3
    ? personality.traits
    : [...personality.traits, ...Array.from({ length: 3 - personality.traits.length }, (_, i) => ({
        name: ['Balanced', 'Adaptive', 'Neutral'][i] || 'Neutral',
        icon: ['⚖️', '🔄', '○'][i] || '○',
        color: 'bg-gray-100 text-gray-500 border-gray-200',
        strength: 10,
      }))];

  return (
    <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-lg border border-pink-200 p-4 mb-4">
      <h3 className="text-sm font-bold text-[#003399] mb-2">🎭 Bot Personality</h3>
      <p className="text-xs text-gray-600 mb-3 italic">{personality.summary}</p>

      {/* Radar chart */}
      <RadarChart traits={radarTraits} />

      {/* Trait pills */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {personality.traits.map(trait => (
          <span
            key={trait.name}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${trait.color} transition-transform hover:scale-105`}
          >
            {trait.icon} {trait.name}
            <span className="text-[9px] opacity-60">{trait.strength}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
