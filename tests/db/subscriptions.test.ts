import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

describe('createSubscription', () => {
  it('inserts subscriber-target pair', async () => {
    let capturedValues: unknown[] = [];
    setAllQueriesHandler((query, values) => {
      if (query.includes('INSERT INTO subscribers')) capturedValues = values;
      return [];
    });

    const { createSubscription } = await import('@/lib/db');
    await createSubscription('follower-bot', 'target-bot');

    expect(capturedValues).toContain('follower-bot');
    expect(capturedValues).toContain('target-bot');
  });
});

describe('removeSubscription', () => {
  it('deletes the subscription', async () => {
    let deleteValues: unknown[] = [];
    setAllQueriesHandler((query, values) => {
      if (query.includes('DELETE FROM subscribers')) deleteValues = values;
      return [];
    });

    const { removeSubscription } = await import('@/lib/db');
    await removeSubscription('follower-bot', 'target-bot');

    expect(deleteValues).toContain('follower-bot');
    expect(deleteValues).toContain('target-bot');
  });
});

describe('getFollowerCount', () => {
  it('returns numeric count', async () => {
    setAllQueriesHandler(() => [{ count: 42 }]);

    const { getFollowerCount } = await import('@/lib/db');
    expect(await getFollowerCount('testbot')).toBe(42);
  });
});

describe('getFollowingCount', () => {
  it('returns numeric count', async () => {
    setAllQueriesHandler(() => [{ count: 7 }]);

    const { getFollowingCount } = await import('@/lib/db');
    expect(await getFollowingCount('testbot')).toBe(7);
  });
});

describe('isFollowing', () => {
  it('returns true when following', async () => {
    setAllQueriesHandler(() => [{ exists: true }]);

    const { isFollowing } = await import('@/lib/db');
    expect(await isFollowing('follower', 'target')).toBe(true);
  });

  it('returns false when not following', async () => {
    setAllQueriesHandler(() => []);

    const { isFollowing } = await import('@/lib/db');
    expect(await isFollowing('follower', 'target')).toBe(false);
  });
});

describe('getFollowers / getFollowing', () => {
  it('getFollowers returns array of usernames', async () => {
    setAllQueriesHandler(() => [
      { subscriber_username: 'fan1' },
      { subscriber_username: 'fan2' },
    ]);

    const { getFollowers } = await import('@/lib/db');
    const followers = await getFollowers('testbot');
    expect(followers).toEqual(['fan1', 'fan2']);
  });

  it('getFollowing returns array of usernames', async () => {
    setAllQueriesHandler(() => [
      { target_username: 'idol1' },
      { target_username: 'idol2' },
    ]);

    const { getFollowing } = await import('@/lib/db');
    const following = await getFollowing('testbot');
    expect(following).toEqual(['idol1', 'idol2']);
  });
});

describe('pinFeedItem', () => {
  it('allows pinning when under 3 pins', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('COUNT')) return [{ count: 2 }];
      if (query.includes('UPDATE feed_items')) return [];
      return [];
    });

    const { pinFeedItem } = await import('@/lib/db');
    const result = await pinFeedItem('feed-1', 'testbot');
    expect(result.error).toBeUndefined();
  });

  it('rejects pinning when at 3 pins', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('COUNT')) return [{ count: 3 }];
      return [];
    });

    const { pinFeedItem } = await import('@/lib/db');
    const result = await pinFeedItem('feed-1', 'testbot');
    expect(result.error).toContain('Maximum 3');
  });
});

describe('rotateApiKey', () => {
  it('updates api_key and key_created_at', async () => {
    let updateQuery = '';
    setAllQueriesHandler((query) => {
      if (query.includes('UPDATE bots') && query.includes('api_key')) updateQuery = query;
      return [];
    });

    const { rotateApiKey } = await import('@/lib/db');
    await rotateApiKey('testbot', 'aims_newkey123');

    expect(updateQuery).toContain('api_key');
    expect(updateQuery).toContain('key_created_at');
  });
});
