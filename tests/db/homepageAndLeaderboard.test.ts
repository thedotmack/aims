import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const makeBotRow = (overrides = {}) => ({
  id: 'bot-1',
  username: 'testbot',
  display_name: 'Test Bot',
  avatar_url: '',
  status_message: '',
  is_online: false,
  api_key: 'aims_key',
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: null,
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
  ...overrides,
});

describe('getHomepageData', () => {
  it('returns expected shape with bots, dmCount, recentActivityCount, networkStats', async () => {
    let callCount = 0;
    setAllQueriesHandler(() => {
      callCount++;
      // Promise.all calls: bots, dmCount, feedCount, stats
      if (callCount === 1) return [makeBotRow()]; // bots
      if (callCount === 2) return [{ c: 5 }]; // dmCount
      if (callCount === 3) return [{ c: 12 }]; // recentActivityCount
      if (callCount === 4) return [{ today_broadcasts: 50, active_bots: 3, active_convos: 2 }];
      return [];
    });

    const { getHomepageData } = await import('@/lib/db');
    const data = await getHomepageData();

    expect(data.bots).toHaveLength(1);
    expect(data.bots[0].username).toBe('testbot');
    // botToPublic strips apiKey
    expect((data.bots[0] as unknown as Record<string, unknown>).apiKey).toBeUndefined();
    expect(data.dmCount).toBe(5);
    expect(data.recentActivityCount).toBe(12);
    expect(data.networkStats).toEqual({
      todayBroadcasts: 50,
      activeBotsCount: 3,
      activeConversations: 2,
    });
  });

  it('returns empty bots array when no bots exist', async () => {
    let callCount = 0;
    setAllQueriesHandler(() => {
      callCount++;
      if (callCount === 1) return []; // no bots
      if (callCount === 2) return [{ c: 0 }];
      if (callCount === 3) return [{ c: 0 }];
      if (callCount === 4) return [{ today_broadcasts: 0, active_bots: 0, active_convos: 0 }];
      return [];
    });

    const { getHomepageData } = await import('@/lib/db');
    const data = await getHomepageData();

    expect(data.bots).toEqual([]);
    expect(data.dmCount).toBe(0);
  });
});

describe('getLeaderboard', () => {
  it('returns sorted leaderboard entries', async () => {
    setAllQueriesHandler(() => [
      { username: 'top-bot', display_name: 'Top Bot', total: 100, thoughts: 50, observations: 30, actions: 20, days_active: 10 },
      { username: 'mid-bot', display_name: 'Mid Bot', total: 50, thoughts: 25, observations: 15, actions: 10, days_active: 5 },
    ]);

    const { getLeaderboard } = await import('@/lib/db');
    const lb = await getLeaderboard('all');

    expect(lb).toHaveLength(2);
    expect(lb[0].username).toBe('top-bot');
    expect(lb[0].total).toBe(100);
    expect(lb[0].thoughts).toBe(50);
    expect(lb[0].daysActive).toBe(10);
    expect(lb[1].total).toBe(50);
  });

  it('returns empty array when no bots', async () => {
    setAllQueriesHandler(() => []);

    const { getLeaderboard } = await import('@/lib/db');
    expect(await getLeaderboard()).toEqual([]);
  });

  it('uses display_name fallback to username', async () => {
    setAllQueriesHandler(() => [
      { username: 'noname', display_name: '', total: 10, thoughts: 5, observations: 3, actions: 2, days_active: 1 },
    ]);

    const { getLeaderboard } = await import('@/lib/db');
    const lb = await getLeaderboard();

    expect(lb[0].displayName).toBe('noname');
  });
});
