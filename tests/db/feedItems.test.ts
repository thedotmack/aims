import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const mockFeedItem = {
  id: 'feed-123',
  bot_username: 'testbot',
  feed_type: 'thought',
  title: 'Test',
  content: 'Test content',
  metadata: '{}',
  reply_to: null,
  pinned: false,
  created_at: new Date(),
  chain_hash: null,
  chain_tx: null,
  source_type: null,
  content_hash: null,
};

describe('createFeedItem', () => {
  it('deducts 1 $AIMS token', async () => {
    let deductValues: unknown[] = [];
    setAllQueriesHandler((query, values) => {
      if (query.includes('UPDATE bots SET token_balance')) {
        deductValues = values;
        return [{ token_balance: 99 }];
      }
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('SELECT') && query.includes('feed_items')) return [mockFeedItem];
      return [];
    });

    const { createFeedItem } = await import('@/lib/db');
    await createFeedItem('testbot', 'thought', 'Test', 'Test content');

    // deductTokens passes (amount, username, amount) in the tagged template
    expect(deductValues).toContain(1);
  });

  it('throws InsufficientTokensError when balance is 0', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('UPDATE bots SET token_balance')) return []; // no rows = insufficient
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: 0 }];
      return [];
    });

    const { createFeedItem, InsufficientTokensError } = await import('@/lib/db');

    await expect(createFeedItem('testbot', 'thought', 'Test', 'content'))
      .rejects.toThrow(InsufficientTokensError);
  });

  it('InsufficientTokensError includes required and balance', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('UPDATE bots SET token_balance')) return [];
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: 0 }];
      return [];
    });

    const { createFeedItem, InsufficientTokensError } = await import('@/lib/db');

    try {
      await createFeedItem('testbot', 'thought', 'Test', 'content');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientTokensError);
      expect((err as InstanceType<typeof InsufficientTokensError>).required).toBe(1);
      expect((err as InstanceType<typeof InsufficientTokensError>).balance).toBe(0);
    }
  });

  it('generates feed- prefixed ID', async () => {
    let insertedId = '';
    setAllQueriesHandler((query, values) => {
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) {
        insertedId = values[0] as string;
        return [];
      }
      if (query.includes('SELECT') && query.includes('feed_items')) return [{ ...mockFeedItem, id: insertedId }];
      return [];
    });

    const { createFeedItem } = await import('@/lib/db');
    const item = await createFeedItem('testbot', 'thought', 'Test', 'content');

    expect(item.id).toMatch(/^feed-/);
  });

  it('passes metadata as JSON string', async () => {
    let capturedValues: unknown[] = [];
    setAllQueriesHandler((query, values) => {
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) {
        capturedValues = values;
        return [];
      }
      if (query.includes('SELECT') && query.includes('feed_items')) return [mockFeedItem];
      return [];
    });

    const { createFeedItem } = await import('@/lib/db');
    await createFeedItem('testbot', 'thought', 'Test', 'content', { source: 'claude-mem' });

    expect(capturedValues).toContain(JSON.stringify({ source: 'claude-mem' }));
  });

  it('passes content_hash for dedup', async () => {
    let capturedValues: unknown[] = [];
    setAllQueriesHandler((query, values) => {
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) {
        capturedValues = values;
        return [];
      }
      if (query.includes('SELECT') && query.includes('feed_items')) return [{ ...mockFeedItem, content_hash: 'abc123' }];
      return [];
    });

    const { createFeedItem } = await import('@/lib/db');
    await createFeedItem('testbot', 'thought', 'Test', 'content', {}, null, null, 'abc123');

    expect(capturedValues).toContain('abc123');
  });
});

describe('feedItemExistsByHash', () => {
  it('returns true when hash exists', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('content_hash')) return [{ '?column?': 1 }];
      return [];
    });

    const { feedItemExistsByHash } = await import('@/lib/db');
    expect(await feedItemExistsByHash('abc123')).toBe(true);
  });

  it('returns false when hash does not exist', async () => {
    setAllQueriesHandler(() => []);

    const { feedItemExistsByHash } = await import('@/lib/db');
    expect(await feedItemExistsByHash('nonexistent')).toBe(false);
  });
});

describe('getGlobalFeed', () => {
  it('returns array of FeedItems', async () => {
    setAllQueriesHandler(() => [mockFeedItem, { ...mockFeedItem, id: 'feed-456' }]);

    const { getGlobalFeed } = await import('@/lib/db');
    const items = await getGlobalFeed(10);

    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('feed-123');
  });

  it('returns empty array when no items', async () => {
    setAllQueriesHandler(() => []);

    const { getGlobalFeed } = await import('@/lib/db');
    expect(await getGlobalFeed()).toEqual([]);
  });
});
