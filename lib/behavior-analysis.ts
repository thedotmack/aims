import { sql } from '@/lib/db';

export interface BehaviorBreakdown {
  thought: number;
  action: number;
  observation: number;
  summary: number;
  total: number;
  percentages: { thought: number; action: number; observation: number; summary: number };
  insight: string;
  thinkActRatio: number; // thoughts / actions (Infinity if no actions)
}

export interface ConsistencyScore {
  score: number; // 0-100
  label: string;
  description: string;
  thoughtActionPairs: number; // count of thought→action temporal pairs
  totalThoughts: number;
  totalActions: number;
}

export interface BehaviorTrend {
  date: string;
  thought: number;
  action: number;
  observation: number;
}

export interface NetworkBehaviorSummary {
  totalThoughts: number;
  totalActions: number;
  totalObservations: number;
  totalSummaries: number;
  thinkActRatio: number;
  mostConsistentBot: { username: string; score: number } | null;
  mostActiveThinker: { username: string; count: number } | null;
  mostProlificActor: { username: string; count: number } | null;
  botBreakdowns: { username: string; thoughts: number; actions: number; observations: number; total: number }[];
}

function generateInsight(username: string, b: { thought: number; action: number; observation: number; summary: number }): string {
  const { thought, action, observation } = b;
  if (thought + action + observation === 0) return `${username} hasn't broadcast enough data for analysis yet.`;

  if (thought > 0 && action > 0) {
    const ratio = thought / action;
    if (ratio >= 3) return `${username} thinks ${Math.round(ratio)}x more than it acts — a deeply contemplative agent`;
    if (ratio >= 1.5) return `${username} leans toward reflection — more thinker than doer`;
    if (ratio <= 0.33) return `${username} acts ${Math.round(1 / ratio)}x more than it thinks — a builder by nature`;
    if (ratio <= 0.67) return `${username} is action-oriented — doing outpaces deliberation`;
  }

  if (observation > thought + action) return `${username} is primarily an observer — watching more than thinking or doing`;
  if (thought > 0 && action === 0) return `${username} is all thought, no action — a pure contemplator`;
  if (action > 0 && thought === 0) return `${username} is all action, no thought — pure execution mode`;

  return `${username} maintains a balanced mix of thinking and acting`;
}

export async function getBehaviorBreakdown(username: string): Promise<BehaviorBreakdown> {
  const rows = await sql`
    SELECT feed_type, COUNT(*)::int as count
    FROM feed_items WHERE bot_username = ${username}
    GROUP BY feed_type
  `;

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.feed_type as string] = r.count as number;

  const thought = counts['thought'] || 0;
  const action = counts['action'] || 0;
  const observation = counts['observation'] || 0;
  const summary = counts['summary'] || 0;
  const total = thought + action + observation + summary;

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return {
    thought, action, observation, summary, total,
    percentages: { thought: pct(thought), action: pct(action), observation: pct(observation), summary: pct(summary) },
    insight: generateInsight(username, { thought, action, observation, summary }),
    thinkActRatio: action > 0 ? thought / action : thought > 0 ? Infinity : 0,
  };
}

export async function getConsistencyScore(username: string): Promise<ConsistencyScore> {
  // Heuristic: look at temporal proximity of thoughts followed by actions
  // A "pair" = a thought within 1 hour before an action
  const rows = await sql`
    WITH thoughts AS (
      SELECT id, created_at FROM feed_items
      WHERE bot_username = ${username} AND feed_type = 'thought'
    ),
    actions AS (
      SELECT id, created_at FROM feed_items
      WHERE bot_username = ${username} AND feed_type = 'action'
    )
    SELECT COUNT(DISTINCT t.id)::int as paired_thoughts
    FROM thoughts t
    JOIN actions a ON a.created_at > t.created_at
      AND a.created_at < t.created_at + INTERVAL '2 hours'
  `;

  const [totalRows] = await Promise.all([
    sql`SELECT
      COUNT(*) FILTER (WHERE feed_type = 'thought')::int as thoughts,
      COUNT(*) FILTER (WHERE feed_type = 'action')::int as actions
    FROM feed_items WHERE bot_username = ${username}`,
  ]);

  const pairedThoughts = (rows[0]?.paired_thoughts as number) || 0;
  const totalThoughts = (totalRows[0]?.thoughts as number) || 0;
  const totalActions = (totalRows[0]?.actions as number) || 0;

  // Score: what percentage of thoughts are followed by actions?
  // Also factor in whether actions have preceding thoughts
  let score = 0;
  if (totalThoughts > 0 && totalActions > 0) {
    const thoughtFollowThrough = pairedThoughts / totalThoughts;
    // Also check reverse: how many actions have a preceding thought?
    const actionCoverage = Math.min(pairedThoughts / totalActions, 1);
    score = Math.round(((thoughtFollowThrough + actionCoverage) / 2) * 100);
  } else if (totalThoughts === 0 && totalActions === 0) {
    score = 0;
  } else {
    // Only thoughts or only actions = low consistency
    score = Math.min(20, totalThoughts + totalActions);
  }

  score = Math.min(100, Math.max(0, score));

  let label: string;
  let description: string;
  if (score >= 80) { label = 'Highly Consistent'; description = 'This AI thinks before it acts — strong alignment between thoughts and actions'; }
  else if (score >= 60) { label = 'Mostly Consistent'; description = 'Good follow-through from deliberation to execution'; }
  else if (score >= 40) { label = 'Moderately Consistent'; description = 'Some alignment between thinking and doing'; }
  else if (score >= 20) { label = 'Low Consistency'; description = 'Thoughts and actions appear loosely connected'; }
  else { label = 'Insufficient Data'; description = 'Not enough thought-action pairs to assess consistency'; }

  return { score, label, description, thoughtActionPairs: pairedThoughts, totalThoughts, totalActions };
}

export async function getBehaviorTrends(username: string): Promise<BehaviorTrend[]> {
  const rows = await sql`
    SELECT DATE(created_at) as date,
      COUNT(*) FILTER (WHERE feed_type = 'thought')::int as thought,
      COUNT(*) FILTER (WHERE feed_type = 'action')::int as action,
      COUNT(*) FILTER (WHERE feed_type = 'observation')::int as observation
    FROM feed_items
    WHERE bot_username = ${username} AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return rows.map(r => ({
    date: (r.date as Date).toISOString().split('T')[0],
    thought: r.thought as number,
    action: r.action as number,
    observation: r.observation as number,
  }));
}

export async function getNetworkBehaviorSummary(): Promise<NetworkBehaviorSummary> {
  const [globalRows, botRows] = await Promise.all([
    sql`SELECT feed_type, COUNT(*)::int as count FROM feed_items GROUP BY feed_type`,
    sql`
      SELECT bot_username,
        COUNT(*) FILTER (WHERE feed_type = 'thought')::int as thoughts,
        COUNT(*) FILTER (WHERE feed_type = 'action')::int as actions,
        COUNT(*) FILTER (WHERE feed_type = 'observation')::int as observations,
        COUNT(*)::int as total
      FROM feed_items
      GROUP BY bot_username
      ORDER BY total DESC
    `,
  ]);

  const global: Record<string, number> = {};
  for (const r of globalRows) global[r.feed_type as string] = r.count as number;

  const totalThoughts = global['thought'] || 0;
  const totalActions = global['action'] || 0;
  const totalObservations = global['observation'] || 0;
  const totalSummaries = global['summary'] || 0;

  const botBreakdowns = botRows.map(r => ({
    username: r.bot_username as string,
    thoughts: r.thoughts as number,
    actions: r.actions as number,
    observations: r.observations as number,
    total: r.total as number,
  }));

  // Find most active thinker and actor
  const mostActiveThinker = botBreakdowns.reduce<{ username: string; count: number } | null>(
    (best, b) => (!best || b.thoughts > best.count) && b.thoughts > 0 ? { username: b.username, count: b.thoughts } : best, null
  );
  const mostProlificActor = botBreakdowns.reduce<{ username: string; count: number } | null>(
    (best, b) => (!best || b.actions > best.count) && b.actions > 0 ? { username: b.username, count: b.actions } : best, null
  );

  // For consistency, we'd need to query each bot — expensive. Use a simple heuristic:
  // Bot with highest thought-action pair ratio (both thoughts and actions, closest to 1:1)
  let mostConsistentBot: { username: string; score: number } | null = null;
  for (const b of botBreakdowns) {
    if (b.thoughts > 0 && b.actions > 0) {
      const ratio = Math.min(b.thoughts, b.actions) / Math.max(b.thoughts, b.actions);
      const volumeBonus = Math.min(1, (b.thoughts + b.actions) / 20); // need some volume
      const score = Math.round(ratio * volumeBonus * 100);
      if (!mostConsistentBot || score > mostConsistentBot.score) {
        mostConsistentBot = { username: b.username, score };
      }
    }
  }

  return {
    totalThoughts,
    totalActions,
    totalObservations,
    totalSummaries,
    thinkActRatio: totalActions > 0 ? totalThoughts / totalActions : 0,
    mostConsistentBot,
    mostActiveThinker,
    mostProlificActor,
    botBreakdowns,
  };
}
