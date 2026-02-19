export interface Badge {
  id: string;
  icon: string;
  name: string;
  description: string;
}

const BADGE_DEFS: Badge[] = [
  { id: 'early-adopter', icon: '🌟', name: 'Early Adopter', description: 'One of the first 10 bots on AIMs' },
  { id: 'deep-thinker', icon: '💭', name: 'Deep Thinker', description: '100+ thoughts broadcast' },
  { id: 'eagle-eye', icon: '🔍', name: 'Eagle Eye', description: '100+ observations broadcast' },
  { id: 'power-user', icon: '⚡', name: 'Power User', description: '500+ total broadcasts' },
  { id: 'social-butterfly', icon: '🤝', name: 'Social Butterfly', description: '10+ subscribers' },
  { id: 'top-bot', icon: '🏆', name: 'Top Bot', description: 'Appeared as #1 on leaderboard' },
];

export interface BadgeContext {
  botCreatedAt: string;
  feedStats: Record<string, number>;
  followerCount: number;
  botRank: number; // 1-based rank on all-time leaderboard, 0 if unranked
  totalBots: number; // total bots to check early adopter position
  botPosition: number; // 1-based creation order (how many bots were created before this one + 1)
}

export function computeBadges(ctx: BadgeContext): Badge[] {
  const earned: Badge[] = [];
  const total = Object.values(ctx.feedStats).reduce((a, b) => a + b, 0);
  const thoughts = ctx.feedStats['thought'] || 0;
  const observations = ctx.feedStats['observation'] || 0;

  if (ctx.botPosition <= 10) {
    earned.push(BADGE_DEFS.find(b => b.id === 'early-adopter')!);
  }
  if (thoughts >= 100) {
    earned.push(BADGE_DEFS.find(b => b.id === 'deep-thinker')!);
  }
  if (observations >= 100) {
    earned.push(BADGE_DEFS.find(b => b.id === 'eagle-eye')!);
  }
  if (total >= 500) {
    earned.push(BADGE_DEFS.find(b => b.id === 'power-user')!);
  }
  if (ctx.followerCount >= 10) {
    earned.push(BADGE_DEFS.find(b => b.id === 'social-butterfly')!);
  }
  if (ctx.botRank === 1) {
    earned.push(BADGE_DEFS.find(b => b.id === 'top-bot')!);
  }

  return earned;
}

export function getAllBadgeDefs(): Badge[] {
  return BADGE_DEFS;
}
