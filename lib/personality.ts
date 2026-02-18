import type { FeedItem } from '@/lib/db';

export interface PersonalityTrait {
  name: string;
  icon: string;
  color: string;
  strength: number; // 0-100
}

export interface BotPersonality {
  traits: PersonalityTrait[];
  dominantType: string;
  summary: string;
}

const KEYWORD_CATEGORIES: Record<string, { keywords: string[]; trait: string; icon: string; color: string }> = {
  analytical: {
    keywords: ['analyze', 'data', 'pattern', 'metric', 'calculate', 'compare', 'evaluate', 'measure', 'statistics', 'evidence'],
    trait: 'Analytical',
    icon: '🔬',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  creative: {
    keywords: ['create', 'design', 'imagine', 'idea', 'novel', 'unique', 'generate', 'invent', 'compose', 'craft'],
    trait: 'Creative',
    icon: '🎨',
    color: 'bg-pink-100 text-pink-700 border-pink-200',
  },
  systematic: {
    keywords: ['system', 'organize', 'structure', 'plan', 'process', 'workflow', 'automate', 'optimize', 'efficient', 'framework'],
    trait: 'Systematic',
    icon: '⚙️',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  curious: {
    keywords: ['explore', 'discover', 'learn', 'investigate', 'research', 'understand', 'wonder', 'question', 'experiment', 'test'],
    trait: 'Curious',
    icon: '🔍',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  collaborative: {
    keywords: ['collaborate', 'share', 'team', 'together', 'help', 'assist', 'support', 'communicate', 'discuss', 'feedback'],
    trait: 'Collaborative',
    icon: '🤝',
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  decisive: {
    keywords: ['decide', 'execute', 'implement', 'deploy', 'launch', 'commit', 'push', 'build', 'ship', 'complete'],
    trait: 'Decisive',
    icon: '⚡',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
  },
};

export function computePersonality(feedItems: FeedItem[]): BotPersonality {
  if (feedItems.length === 0) {
    return { traits: [], dominantType: 'unknown', summary: 'Not enough data to determine personality.' };
  }

  // Type-based scoring
  const typeCounts: Record<string, number> = {};
  for (const item of feedItems) {
    typeCounts[item.feedType] = (typeCounts[item.feedType] || 0) + 1;
  }
  const total = feedItems.length;

  // Keyword analysis
  const categoryScores: Record<string, number> = {};
  const allText = feedItems.map(i => `${i.title} ${i.content}`).join(' ').toLowerCase();
  
  for (const [cat, { keywords }] of Object.entries(KEYWORD_CATEGORIES)) {
    let score = 0;
    for (const kw of keywords) {
      const regex = new RegExp(kw, 'gi');
      const matches = allText.match(regex);
      if (matches) score += matches.length;
    }
    categoryScores[cat] = score;
  }

  // Type-based trait boosting
  const thoughtRatio = (typeCounts['thought'] || 0) / total;
  const actionRatio = (typeCounts['action'] || 0) / total;
  const observationRatio = (typeCounts['observation'] || 0) / total;

  if (thoughtRatio > 0.4) categoryScores['analytical'] = (categoryScores['analytical'] || 0) + 20;
  if (actionRatio > 0.4) categoryScores['decisive'] = (categoryScores['decisive'] || 0) + 20;
  if (observationRatio > 0.4) categoryScores['curious'] = (categoryScores['curious'] || 0) + 20;

  // Normalize and rank
  const maxScore = Math.max(...Object.values(categoryScores), 1);
  const traits: PersonalityTrait[] = Object.entries(KEYWORD_CATEGORIES)
    .map(([cat, info]) => ({
      name: info.trait,
      icon: info.icon,
      color: info.color,
      strength: Math.round(((categoryScores[cat] || 0) / maxScore) * 100),
    }))
    .filter(t => t.strength > 10)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 4);

  // Dominant type
  const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

  // Summary
  const topTrait = traits[0]?.name || 'Balanced';
  const typeLabel = dominantType === 'thought' ? 'reflective' : dominantType === 'action' ? 'action-oriented' : dominantType === 'observation' ? 'observant' : 'versatile';
  const summary = `A ${typeLabel} bot with ${topTrait.toLowerCase()} tendencies. ${
    traits.length > 1 ? `Also shows ${traits.slice(1).map(t => t.name.toLowerCase()).join(', ')} characteristics.` : ''
  }`;

  return { traits, dominantType, summary };
}
