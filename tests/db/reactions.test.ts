import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

describe('addReaction', () => {
  it('inserts with ON CONFLICT DO NOTHING (idempotent)', async () => {
    let insertQuery = '';
    setAllQueriesHandler((query) => {
      if (query.includes('INSERT INTO feed_reactions')) insertQuery = query;
      return [];
    });

    const { addReaction } = await import('@/lib/db');
    await addReaction('feed-1', '👍', 'session-1');

    expect(insertQuery).toContain('ON CONFLICT');
    expect(insertQuery).toContain('DO NOTHING');
  });

  it('passes correct values', async () => {
    let capturedValues: unknown[] = [];
    setAllQueriesHandler((query, values) => {
      if (query.includes('INSERT INTO feed_reactions')) capturedValues = values;
      return [];
    });

    const { addReaction } = await import('@/lib/db');
    await addReaction('feed-1', '🔥', 'session-abc');

    expect(capturedValues).toContain('feed-1');
    expect(capturedValues).toContain('🔥');
    expect(capturedValues).toContain('session-abc');
  });
});

describe('removeReaction', () => {
  it('deletes by feedItemId, emoji, and sessionId', async () => {
    let deleteValues: unknown[] = [];
    setAllQueriesHandler((query, values) => {
      if (query.includes('DELETE FROM feed_reactions')) deleteValues = values;
      return [];
    });

    const { removeReaction } = await import('@/lib/db');
    await removeReaction('feed-1', '👍', 'session-1');

    expect(deleteValues).toContain('feed-1');
    expect(deleteValues).toContain('👍');
    expect(deleteValues).toContain('session-1');
  });
});

describe('getReactionCounts', () => {
  it('returns grouped counts by feedItemId and emoji', async () => {
    setAllQueriesHandler(() => [
      { feed_item_id: 'feed-1', emoji: '👍', count: 5 },
      { feed_item_id: 'feed-1', emoji: '🔥', count: 3 },
      { feed_item_id: 'feed-2', emoji: '👍', count: 1 },
    ]);

    const { getReactionCounts } = await import('@/lib/db');
    const counts = await getReactionCounts(['feed-1', 'feed-2']);

    expect(counts['feed-1']['👍']).toBe(5);
    expect(counts['feed-1']['🔥']).toBe(3);
    expect(counts['feed-2']['👍']).toBe(1);
  });

  it('returns empty object for empty input', async () => {
    const { getReactionCounts } = await import('@/lib/db');
    const counts = await getReactionCounts([]);
    expect(counts).toEqual({});
  });
});

describe('getUserReactions', () => {
  it('returns user reactions grouped by feedItemId', async () => {
    setAllQueriesHandler(() => [
      { feed_item_id: 'feed-1', emoji: '👍' },
      { feed_item_id: 'feed-1', emoji: '🔥' },
    ]);

    const { getUserReactions } = await import('@/lib/db');
    const reactions = await getUserReactions(['feed-1'], 'session-1');

    expect(reactions['feed-1']).toEqual(['👍', '🔥']);
  });

  it('returns empty object for empty input', async () => {
    const { getUserReactions } = await import('@/lib/db');
    const reactions = await getUserReactions([], 'session-1');
    expect(reactions).toEqual({});
  });
});
