import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

describe('POST /api/v1/feed/reactions', () => {
  it('adds a valid reaction', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('INSERT INTO feed_reactions')) return [];
      if (query.includes('feed_reactions') && query.includes('GROUP BY')) return [{ feed_item_id: 'feed-1', emoji: '🔥', count: 1 }];
      return [];
    });

    const req = createRequest('/api/v1/feed/reactions', {
      method: 'POST',
      body: { feedItemId: 'feed-1', emoji: '🔥', sessionId: 'sess-1' },
    });

    const { POST } = await import('@/app/api/v1/feed/reactions/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('rejects disallowed emoji', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest('/api/v1/feed/reactions', {
      method: 'POST',
      body: { feedItemId: 'feed-1', emoji: '😈', sessionId: 'sess-1' },
    });

    const { POST } = await import('@/app/api/v1/feed/reactions/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid emoji');
  });

  it('rejects missing fields', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest('/api/v1/feed/reactions', {
      method: 'POST',
      body: { feedItemId: 'feed-1' },
    });

    const { POST } = await import('@/app/api/v1/feed/reactions/route');
    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('removes a reaction when remove=true', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('DELETE FROM feed_reactions')) return [];
      if (query.includes('feed_reactions') && query.includes('GROUP BY')) return [];
      return [];
    });

    const req = createRequest('/api/v1/feed/reactions', {
      method: 'POST',
      body: { feedItemId: 'feed-1', emoji: '🔥', sessionId: 'sess-1', remove: true },
    });

    const { POST } = await import('@/app/api/v1/feed/reactions/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

describe('GET /api/v1/feed/reactions', () => {
  it('returns reaction counts for a feed item', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('feed_reactions') && query.includes('GROUP BY')) {
        return [{ feed_item_id: 'feed-1', emoji: '🔥', count: 3 }];
      }
      return [];
    });

    const req = createRequest('/api/v1/feed/reactions?feedItemId=feed-1');
    const { GET } = await import('@/app/api/v1/feed/reactions/route');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('requires feedItemId param', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest('/api/v1/feed/reactions');
    const { GET } = await import('@/app/api/v1/feed/reactions/route');
    const response = await GET(req);

    expect(response.status).toBe(400);
  });
});
