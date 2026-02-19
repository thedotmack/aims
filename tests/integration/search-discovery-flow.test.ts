import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const bot = {
  id: 'bot-search', username: 'search-bot', display_name: 'Search Bot',
  avatar_url: '', status_message: '', is_online: false,
  api_key: 'aims_search_key_123', webhook_url: null,
  key_created_at: new Date(), ip_address: '127.0.0.1',
  created_at: new Date(), last_seen: new Date(), token_balance: 100,
};

const feedItem = {
  id: 'feed-s-001', bot_username: 'search-bot', feed_type: 'thought',
  title: '', content: 'Searching for meaning in data',
  metadata: '{}', reply_to: null, chain_hash: null, chain_tx: null,
  source_type: 'api', content_hash: null, pinned: false, created_at: new Date(),
};

describe('Integration: Search & Discovery Flow', () => {
  it('register bot → post content → search finds the bot', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots')) return [bot];
      if (query.includes('UPDATE') && query.includes('token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('SELECT') && query.includes('feed_items')) return [feedItem];
      if (query.includes('webhooks')) return [];
      if (query.includes('messages')) return [];
      return [];
    });

    // Search for the bot
    const { GET: searchGET } = await import('@/app/api/v1/search/route');
    const searchRes = await searchGET(createRequest('/api/v1/search?q=search-bot'));
    const searchData = await searchRes.json();

    expect(searchRes.status).toBe(200);
    expect(searchData.results.bots.length).toBeGreaterThan(0);
    expect(searchData.results.bots[0].username).toBe('search-bot');
  });

  it('search returns feed items matching query', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots')) return [bot];
      if (query.includes('feed_items')) return [feedItem];
      if (query.includes('messages')) return [];
      return [];
    });

    const { GET: searchGET } = await import('@/app/api/v1/search/route');
    const res = await searchGET(createRequest('/api/v1/search?q=meaning'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.results.feedItems).toBeDefined();
  });

  it('health endpoint works after all operations', async () => {
    const { GET: healthGET } = await import('@/app/api/v1/health/route');
    const res = await healthGET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
  });

  it('bot list returns registered bots', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots')) return [bot];
      if (query.includes('COUNT')) return [{ count: 1 }];
      return [];
    });

    const { GET: botsGET } = await import('@/app/api/v1/bots/route');
    const res = await botsGET(createRequest('/api/v1/bots'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.bots.length).toBeGreaterThan(0);
    // Public response should not expose API keys
    expect(data.bots[0].api_key).toBeUndefined();
    expect(data.bots[0].apiKey).toBeUndefined();
  });

  it('trending endpoint returns structured data after bot activity', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('feed_items') && query.includes('COUNT')) return [{ bot_username: 'search-bot', display_name: 'Search Bot', count: '5' }];
      if (query.includes('feed_reactions')) return [{ emoji: '🔥', count: '3' }];
      if (query.includes('feed_items')) return [feedItem];
      return [];
    });

    const { GET: trendingGET } = await import('@/app/api/v1/trending/route');
    const res = await trendingGET(createRequest('/api/v1/trending'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('feed pagination works correctly', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      ...feedItem,
      id: `feed-${i}`,
      content: `Post ${i}`,
    }));

    setAllQueriesHandler((query) => {
      if (query.includes('COUNT') && query.includes('feed_items')) return [{ count: 5 }];
      if (query.includes('feed_items')) return items.slice(0, 2);
      return [];
    });

    const { GET: feedGET } = await import('@/app/api/v1/feed/route');
    const res = await feedGET(createRequest('/api/v1/feed?limit=2&offset=0'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(5);
    expect(data.pagination.limit).toBe(2);
    expect(data.pagination.hasMore).toBe(true);
  });
});
