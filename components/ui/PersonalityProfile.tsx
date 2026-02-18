'use client';

import type { BotPersonality } from '@/lib/personality';

export default function PersonalityProfile({ personality }: { personality: BotPersonality }) {
  if (personality.traits.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-lg border border-pink-200 p-4 mb-4">
      <h3 className="text-sm font-bold text-[#003399] mb-2">🎭 Bot Personality</h3>
      <p className="text-xs text-gray-600 mb-3 italic">{personality.summary}</p>
      <div className="flex flex-wrap gap-1.5">
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
