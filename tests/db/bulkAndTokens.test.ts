import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const mockFeedItem = (id: string) => ({
  id,
  bot_username: 'testbot',
  feed_type: 'thought',
  title: 'Test',
  content: 'Content',
  metadata: '{}',
  reply_to: null,
  pinned: false,
  created_at: new Date(),
  chain_hash: null,
  chain_tx: null,
  source_type: null,
  content_hash: null,
});

describe('bulkCreateFeedItems', () => {
  it('creates multiple items without token deduction', async () => {
    let insertCount = 0;
    let tokenDeducted = false;
    setAllQueriesHandler((query, values) => {
      if (query.includes('UPDATE bots SET token_balance')) { tokenDeducted = true; return []; }
      if (query.includes('INSERT INTO feed_items')) {
        insertCount++;
        return [];
      }
      if (query.includes('SELECT') && query.includes('feed_items')) return [mockFeedItem(`feed-${insertCount}`)];
      return [];
    });

    const { bulkCreateFeedItems } = await import('@/lib/db');
    const items = await bulkCreateFeedItems('testbot', [
      { type: 'thought', title: 'A', content: 'Content A' },
      { type: 'action', title: 'B', content: 'Content B' },
      { type: 'observation', title: 'C', content: 'Content C' },
    ]);

    expect(items).toHaveLength(3);
    expect(insertCount).toBe(3);
    expect(tokenDeducted).toBe(false);
  });

  it('returns empty array for empty input', async () => {
    setAllQueriesHandler(() => []);

    const { bulkCreateFeedItems } = await import('@/lib/db');
    const items = await bulkCreateFeedItems('testbot', []);

    expect(items).toEqual([]);
  });

  it('supports custom created_at', async () => {
    let capturedValues: unknown[] = [];
    setAllQueriesHandler((query, values) => {
      if (query.includes('INSERT INTO feed_items')) {
        capturedValues = values;
        return [];
      }
      if (query.includes('SELECT') && query.includes('feed_items')) return [mockFeedItem('feed-1')];
      return [];
    });

    const { bulkCreateFeedItems } = await import('@/lib/db');
    await bulkCreateFeedItems('testbot', [
      { type: 'thought', title: 'Test', content: 'Content', created_at: '2024-01-01T00:00:00Z' },
    ]);

    expect(capturedValues).toContain('2024-01-01T00:00:00Z');
  });
});

describe('deductTokens', () => {
  it('returns true when sufficient balance', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 99 }];
      return [];
    });

    const { deductTokens } = await import('@/lib/db');
    expect(await deductTokens('testbot', 1)).toBe(true);
  });

  it('returns false when insufficient balance', async () => {
    setAllQueriesHandler(() => []);

    const { deductTokens } = await import('@/lib/db');
    expect(await deductTokens('testbot', 1)).toBe(false);
  });
});

describe('addTokens', () => {
  it('executes UPDATE to add tokens', async () => {
    let updateValues: unknown[] = [];
    setAllQueriesHandler((query, values) => {
      if (query.includes('UPDATE bots SET token_balance')) updateValues = values;
      return [];
    });

    const { addTokens } = await import('@/lib/db');
    await addTokens('testbot', 50);

    expect(updateValues).toContain(50);
    expect(updateValues).toContain('testbot');
  });
});

describe('getBotTokenBalance', () => {
  it('returns numeric balance', async () => {
    setAllQueriesHandler(() => [{ token_balance: 42 }]);

    const { getBotTokenBalance } = await import('@/lib/db');
    expect(await getBotTokenBalance('testbot')).toBe(42);
  });

  it('returns 0 when bot not found', async () => {
    setAllQueriesHandler(() => []);

    const { getBotTokenBalance } = await import('@/lib/db');
    expect(await getBotTokenBalance('nonexistent')).toBe(0);
  });

  it('handles null token_balance', async () => {
    setAllQueriesHandler(() => [{ token_balance: null }]);

    const { getBotTokenBalance } = await import('@/lib/db');
    expect(await getBotTokenBalance('testbot')).toBe(0);
  });
});

describe('TOKEN_COSTS constants', () => {
  it('has correct values', async () => {
    const { TOKEN_COSTS } = await import('@/lib/db');
    expect(TOKEN_COSTS.FEED_POST).toBe(1);
    expect(TOKEN_COSTS.DM_MESSAGE).toBe(2);
    expect(TOKEN_COSTS.SIGNUP_BONUS).toBe(100);
  });
});
