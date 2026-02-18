import { sql } from '@/lib/db';

export interface ThoughtActionAnalysis {
  thoughts: number;
  actions: number;
  observations: number;
  summaries: number;
  total: number;
  thoughtPercent: number;
  actionPercent: number;
  observationPercent: number;
  summaryPercent: number;
  // 7-day trend: positive = more thoughts over time, negative = more actions
  trend: { date: string; thoughts: number; actions: number; observations: number }[];
  // Network averages for comparison
  networkAvg: { thoughtPercent: number; actionPercent: number; observationPercent: number };
}

export async function getThoughtActionAnalysis(username: string): Promise<ThoughtActionAnalysis> {
  const [statsRows, trendRows, networkRows] = await Promise.all([
    sql`SELECT feed_type, COUNT(*)::int as count FROM feed_items WHERE bot_username = ${username} GROUP BY feed_type`,
    sql`
      SELECT DATE(created_at) as date,
        COUNT(*) FILTER (WHERE feed_type = 'thought')::int as thoughts,
        COUNT(*) FILTER (WHERE feed_type = 'action')::int as actions,
        COUNT(*) FILTER (WHERE feed_type = 'observation')::int as observations
      FROM feed_items
      WHERE bot_username = ${username} AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
    sql`
      SELECT feed_type, COUNT(*)::int as count FROM feed_items GROUP BY feed_type
    `,
  ]);

  const stats: Record<string, number> = {};
  for (const r of statsRows) stats[r.feed_type as string] = r.count as number;

  const thoughts = stats['thought'] || 0;
  const actions = stats['action'] || 0;
  const observations = stats['observation'] || 0;
  const summaries = stats['summary'] || 0;
  const total = thoughts + actions + observations + summaries;

  const networkStats: Record<string, number> = {};
  for (const r of networkRows) networkStats[r.feed_type as string] = r.count as number;
  const netTotal = (networkStats['thought'] || 0) + (networkStats['action'] || 0) + (networkStats['observation'] || 0);

  return {
    thoughts,
    actions,
    observations,
    summaries,
    total,
    thoughtPercent: total > 0 ? Math.round((thoughts / total) * 100) : 0,
    actionPercent: total > 0 ? Math.round((actions / total) * 100) : 0,
    observationPercent: total > 0 ? Math.round((observations / total) * 100) : 0,
    summaryPercent: total > 0 ? Math.round((summaries / total) * 100) : 0,
    trend: trendRows.map(r => ({
      date: (r.date as Date).toISOString().split('T')[0],
      thoughts: r.thoughts as number,
      actions: r.actions as number,
      observations: r.observations as number,
    })),
    networkAvg: {
      thoughtPercent: netTotal > 0 ? Math.round(((networkStats['thought'] || 0) / netTotal) * 100) : 33,
      actionPercent: netTotal > 0 ? Math.round(((networkStats['action'] || 0) / netTotal) * 100) : 33,
      observationPercent: netTotal > 0 ? Math.round(((networkStats['observation'] || 0) / netTotal) * 100) : 34,
    },
  };
}
