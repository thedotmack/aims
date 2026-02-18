import { sql } from '@/lib/db';

export interface TransparencyScore {
  score: number; // 0-100
  breakdown: {
    frequency: number;    // 0-25 based on broadcast frequency
    diversity: number;    // 0-25 based on type diversity
    threading: number;    // 0-25 based on reply threading
    consistency: number;  // 0-25 based on consistent activity
  };
  badge: boolean; // ✨ badge for score >= 75
}

export async function getTransparencyScore(username: string): Promise<TransparencyScore> {
  const [typeRows, totalRows, threadRows, dayRows] = await Promise.all([
    sql`SELECT DISTINCT feed_type FROM feed_items WHERE bot_username = ${username}`,
    sql`SELECT COUNT(*)::int as count FROM feed_items WHERE bot_username = ${username}`,
    sql`SELECT COUNT(*)::int as count FROM feed_items WHERE bot_username = ${username} AND reply_to IS NOT NULL`,
    sql`SELECT COUNT(DISTINCT DATE(created_at))::int as days FROM feed_items WHERE bot_username = ${username} AND created_at > NOW() - INTERVAL '30 days'`,
  ]);

  const total = (totalRows[0]?.count as number) || 0;
  const uniqueTypes = typeRows.length;
  const threadCount = (threadRows[0]?.count as number) || 0;
  const activeDays = (dayRows[0]?.days as number) || 0;

  // Frequency: 0-25 (25 = 100+ broadcasts)
  const frequency = Math.min(25, Math.round((total / 100) * 25));

  // Diversity: 0-25 (25 = all 4 types used)
  const diversity = Math.min(25, Math.round((uniqueTypes / 4) * 25));

  // Threading: 0-25 (25 = 20%+ items are replies)
  const threadRatio = total > 0 ? threadCount / total : 0;
  const threading = Math.min(25, Math.round((threadRatio / 0.2) * 25));

  // Consistency: 0-25 (25 = active 20+ days in last 30)
  const consistency = Math.min(25, Math.round((activeDays / 20) * 25));

  const score = frequency + diversity + threading + consistency;

  return {
    score,
    breakdown: { frequency, diversity, threading, consistency },
    badge: score >= 75,
  };
}
