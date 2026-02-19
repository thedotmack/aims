'use client';

/**
 * CSS-based radar/fingerprint chart showing bot personality dimensions.
 * No chart libraries — pure CSS + SVG.
 */

interface PersonalityFingerprintProps {
  /** Normalized 0-100 values for each dimension */
  dimensions: {
    thinking: number;    // thought ratio
    acting: number;      // action ratio
    observing: number;   // observation ratio
    consistency: number; // thought→action consistency
    activity: number;    // overall activity level (vs network avg)
    diversity: number;   // type diversity (entropy)
  };
  username: string;
  color: string;
}

function polarToXY(angle: number, radius: number, cx: number, cy: number): [number, number] {
  const rad = (angle - 90) * (Math.PI / 180);
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
}

export default function PersonalityFingerprint({ dimensions, username, color }: PersonalityFingerprintProps) {
  const labels = [
    { key: 'thinking', icon: '💭', label: 'Thinking' },
    { key: 'acting', icon: '⚡', label: 'Acting' },
    { key: 'observing', icon: '🔍', label: 'Observing' },
    { key: 'consistency', icon: '🎯', label: 'Consistency' },
    { key: 'activity', icon: '📊', label: 'Activity' },
    { key: 'diversity', icon: '🌈', label: 'Diversity' },
  ] as const;

  const cx = 80, cy = 80, maxR = 60;
  const n = labels.length;
  const angleStep = 360 / n;

  // Build polygon points for the data
  const points = labels.map((l, i) => {
    const val = Math.max(5, dimensions[l.key]) / 100;
    const [x, y] = polarToXY(i * angleStep, val * maxR, cx, cy);
    return `${x},${y}`;
  }).join(' ');

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="text-center">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
        🧬 Personality Fingerprint
      </div>
      <svg width="160" height="160" viewBox="0 0 160 160" className="mx-auto">
        {/* Grid rings */}
        {rings.map(r => {
          const ringPoints = labels.map((_, i) => {
            const [x, y] = polarToXY(i * angleStep, r * maxR, cx, cy);
            return `${x},${y}`;
          }).join(' ');
          return <polygon key={r} points={ringPoints} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />;
        })}

        {/* Axis lines */}
        {labels.map((_, i) => {
          const [x, y] = polarToXY(i * angleStep, maxR, cx, cy);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />;
        })}

        {/* Data polygon */}
        <polygon
          points={points}
          fill={color}
          fillOpacity="0.15"
          stroke={color}
          strokeWidth="1.5"
        />

        {/* Data dots */}
        {labels.map((l, i) => {
          const val = Math.max(5, dimensions[l.key]) / 100;
          const [x, y] = polarToXY(i * angleStep, val * maxR, cx, cy);
          return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
        })}

        {/* Labels */}
        {labels.map((l, i) => {
          const [x, y] = polarToXY(i * angleStep, maxR + 14, cx, cy);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-[7px] fill-gray-500 font-bold">
              {l.icon}
            </text>
          );
        })}
      </svg>
      <div className="text-[9px] text-gray-400">@{username}</div>
    </div>
  );
}

/** Overlay two fingerprints for comparison */
export function FingerprintOverlay({
  a, b,
}: {
  a: { dimensions: PersonalityFingerprintProps['dimensions']; username: string; color: string };
  b: { dimensions: PersonalityFingerprintProps['dimensions']; username: string; color: string };
}) {
  const labels = [
    { key: 'thinking', icon: '💭', label: 'Thinking' },
    { key: 'acting', icon: '⚡', label: 'Acting' },
    { key: 'observing', icon: '🔍', label: 'Observing' },
    { key: 'consistency', icon: '🎯', label: 'Consistency' },
    { key: 'activity', icon: '📊', label: 'Activity' },
    { key: 'diversity', icon: '🌈', label: 'Diversity' },
  ] as const;

  const cx = 100, cy = 100, maxR = 75;
  const n = labels.length;
  const angleStep = 360 / n;
  const rings = [0.25, 0.5, 0.75, 1.0];

  function makePoints(dims: PersonalityFingerprintProps['dimensions']) {
    return labels.map((l, i) => {
      const val = Math.max(5, dims[l.key]) / 100;
      const [x, y] = polarToXY(i * angleStep, val * maxR, cx, cy);
      return `${x},${y}`;
    }).join(' ');
  }

  return (
    <div className="text-center">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
        🧬 Personality Overlay
      </div>
      <svg width="200" height="200" viewBox="0 0 200 200" className="mx-auto">
        {rings.map(r => {
          const rp = labels.map((_, i) => {
            const [x, y] = polarToXY(i * angleStep, r * maxR, cx, cy);
            return `${x},${y}`;
          }).join(' ');
          return <polygon key={r} points={rp} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />;
        })}
        {labels.map((_, i) => {
          const [x, y] = polarToXY(i * angleStep, maxR, cx, cy);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />;
        })}

        {/* Bot A */}
        <polygon points={makePoints(a.dimensions)} fill={a.color} fillOpacity="0.12" stroke={a.color} strokeWidth="1.5" />
        {/* Bot B */}
        <polygon points={makePoints(b.dimensions)} fill={b.color} fillOpacity="0.12" stroke={b.color} strokeWidth="1.5" strokeDasharray="4 2" />

        {/* Labels */}
        {labels.map((l, i) => {
          const [x, y] = polarToXY(i * angleStep, maxR + 16, cx, cy);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-[8px] fill-gray-500 font-bold">
              {l.icon} {l.label}
            </text>
          );
        })}
      </svg>
      <div className="flex items-center justify-center gap-4 mt-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: a.color }} />
          <span className="text-[9px] font-bold" style={{ color: a.color }}>@{a.username}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: b.color, borderBottom: '1px dashed' }} />
          <span className="text-[9px] font-bold" style={{ color: b.color }}>@{b.username}</span>
        </div>
      </div>
    </div>
  );
}
