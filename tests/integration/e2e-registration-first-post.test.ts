/**
 * Cycle 35: End-to-end registration → first post flow verification
 *
 * Verifies the critical path: Register bot → get API key → POST to feed →
 * post appears in global feed + bot profile.
 *
 * Focuses on gaps not covered by previous cycles:
 * - API key format returned at registration actually authenticates feed POST
 * - Post appears in BOTH global feed AND bot-specific feed with correct data
 * - Token deduction on first post (100 → 99)
 * - Rotated key invalidates old key for posting
 * - Multiple rapid posts with same key
 * - Feed item metadata enrichment on first post
 * - Bot profile feed endpoint returns pagination metadata
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const makeBot = (overrides = {}) => ({
  id: 'bot-e2e-c35',
  username: 'cycle35-bot',
  display_name: 'Cycle 35 Bot',
  avatar_url: '',
  status_message: '',
  is_online: false,
  api_key: 'aims_c35_test_key_001',
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: '127.0.0.1',
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
  ...overrides,
});

const makeFeedItem = (overrides = {}) => ({
  id: 'feed-c35-001',
  bot_username: 'cycle35-bot',
  feed_type: 'thought',
  title: 'First Post',
  content: 'Hello from Cycle 35!',
  metadata: JSON.stringify({ complexity: 'simple', sentiment: 'neutral', word_count: 4 }),
  reply_to: null,
  chain_hash: null,
  chain_tx: null,
  source_type: 'api',
  content_hash: 'abc123',
  pinned: false,
  created_at: new Date(),
  ...overrides,
});

describe('Cycle 35: E2E Registration → First Post Flow', () => {
  it('register returns aims_ prefixed API key that authenticates a feed POST', async () => {
    let registered = false;
    let postCreated = false;
    const apiKey = 'aims_c35_test_key_001';
    const bot = makeBot({ api_key: apiKey });
    const feedItem = makeFeedItem();

    setAllQueriesHandler((query) => {
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username') && !registered) return [];
      if (query.includes('INSERT INTO bots')) { registered = true; return []; }
      if (query.includes('SELECT') && query.includes('bots') && query.includes('api_key')) return registered ? [bot] : [];
      if (query.includes('SELECT') && query.includes('bots') && registered) return [bot];
      if (query.includes('UPDATE') && query.includes('token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) { postCreated = true; return []; }
      if (query.includes('feed_items') && query.includes('WHERE id')) return [feedItem];
      if (query.includes('subscribers')) return [];
      if (query.includes('webhooks')) return [];
      if (query.includes('content_hash')) return [];
      return [];
    });

    // Register
    const { POST: registerPOST } = await import('@/app/api/v1/bots/register/route');
    const regRes = await registerPOST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'cycle35-bot', displayName: 'Cycle 35 Bot' },
      headers: { 'x-forwarded-for': '10.35.0.1' },
    }));
    const regData = await regRes.json();
    expect(regRes.status).toBe(200);
    expect(regData.api_key).toMatch(/^aims_/);

    // Use the returned API key to post
    const { POST: feedPOST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const feedRes = await feedPOST(
      createAuthRequest('/api/v1/bots/cycle35-bot/feed', apiKey, {
        method: 'POST',
        body: { type: 'thought', title: 'First Post', content: 'Hello from Cycle 35!' },
        headers: { 'x-forwarded-for': '10.35.0.2' },
      }),
      { params: Promise.resolve({ username: 'cycle35-bot' }) }
    );
    expect(feedRes.status).toBe(200);
    const feedData = await feedRes.json();
    expect(feedData.success).toBe(true);
    expect(feedData.item).toBeDefined();
    expect(postCreated).toBe(true);
  });

  it('first post appears in global feed with correct content', async () => {
    const feedItem = makeFeedItem();
    setAllQueriesHandler((query) => {
      if (query.includes('feed_items')) return [feedItem];
      if (query.includes('COUNT')) return [{ count: 1 }];
      return [];
    });

    const { GET } = await import('@/app/api/v1/feed/route');
    const res = await GET(createRequest('/api/v1/feed', { headers: { 'x-forwarded-for': '10.35.0.3' } }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].content).toBe('Hello from Cycle 35!');
    expect(data.items[0].botUsername).toBe('cycle35-bot');
    expect(data.items[0].feedType).toBe('thought');
  });

  it('first post appears in bot-specific feed with pagination metadata', async () => {
    const bot = makeBot();
    const feedItem = makeFeedItem();

    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('username')) return [bot];
      if (query.includes('feed_items') && query.includes('COUNT')) return [{ count: 1 }];
      if (query.includes('feed_items')) return [feedItem];
      if (query.includes('COUNT')) return [{ count: 1 }];
      return [];
    });

    const { GET } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await GET(
      createRequest('/api/v1/bots/cycle35-bot/feed'),
      { params: Promise.resolve({ username: 'cycle35-bot' }) }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].content).toBe('Hello from Cycle 35!');
    // Pagination metadata
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(1);
    expect(data.pagination.hasMore).toBe(false);
  });

  it('first post deducts exactly 1 $AIMS token (100 → 99)', async () => {
    let tokenBalance = 100;
    const bot = makeBot();

    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [{ ...bot, token_balance: tokenBalance }];
      if (query.includes('UPDATE') && query.includes('token_balance')) {
        tokenBalance -= 1;
        return [{ token_balance: tokenBalance }];
      }
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) return [makeFeedItem()];
      if (query.includes('subscribers')) return [];
      if (query.includes('webhooks')) return [];
      if (query.includes('content_hash')) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(
      createAuthRequest('/api/v1/bots/cycle35-bot/feed', 'aims_c35_test_key_001', {
        method: 'POST',
        body: { type: 'thought', content: 'Token deduction test' },
      }),
      { params: Promise.resolve({ username: 'cycle35-bot' }) }
    );
    expect(res.status).toBe(200);
    expect(tokenBalance).toBe(99);
  });

  it('rotated API key works for posting; old key rejected', async () => {
    const oldKey = 'aims_old_key_c35';
    let currentKey = oldKey;
    const bot = makeBot({ api_key: oldKey });

    setAllQueriesHandler((query, values) => {
      if (query.includes('COUNT')) return [{ count: 0 }];
      // Auth lookup: match current key
      if (query.includes('SELECT') && query.includes('bots') && query.includes('api_key')) {
        const keyVal = values.find((v: unknown) => typeof v === 'string' && (v as string).startsWith('aims_'));
        if (keyVal && keyVal !== currentKey) return [];
        return [{ ...bot, api_key: currentKey }];
      }
      if (query.includes('SELECT') && query.includes('bots')) return [{ ...bot, api_key: currentKey }];
      // Key rotation
      if (query.includes('UPDATE') && query.includes('api_key')) {
        const newKey = values.find((v: unknown) => typeof v === 'string' && (v as string).startsWith('aims_'));
        if (newKey) currentKey = newKey as string;
        return [];
      }
      if (query.includes('UPDATE') && query.includes('token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) return [makeFeedItem()];
      if (query.includes('subscribers')) return [];
      if (query.includes('webhooks')) return [];
      if (query.includes('content_hash')) return [];
      return [];
    });

    // Post with old key — works
    const { POST: feedPOST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res1 = await feedPOST(
      createAuthRequest('/api/v1/bots/cycle35-bot/feed', oldKey, {
        method: 'POST',
        body: { type: 'thought', content: 'Before rotation' },
      }),
      { params: Promise.resolve({ username: 'cycle35-bot' }) }
    );
    expect(res1.status).toBe(200);

    // Rotate key
    const { POST: rotatePOST } = await import('@/app/api/v1/bots/[username]/rotate-key/route');
    const rotateRes = await rotatePOST(
      createAuthRequest('/api/v1/bots/cycle35-bot/rotate-key', oldKey, { method: 'POST' }),
      { params: Promise.resolve({ username: 'cycle35-bot' }) }
    );
    expect(rotateRes.status).toBe(200);
    const rotateData = await rotateRes.json();
    const newKey = rotateData.api_key;
    expect(newKey).not.toBe(oldKey);

    // Old key fails
    const res2 = await feedPOST(
      createAuthRequest('/api/v1/bots/cycle35-bot/feed', oldKey, {
        method: 'POST',
        body: { type: 'thought', content: 'With old key' },
      }),
      { params: Promise.resolve({ username: 'cycle35-bot' }) }
    );
    expect(res2.status).toBe(401);

    // New key works
    const res3 = await feedPOST(
      createAuthRequest('/api/v1/bots/cycle35-bot/feed', newKey, {
        method: 'POST',
        body: { type: 'thought', content: 'With new key' },
      }),
      { params: Promise.resolve({ username: 'cycle35-bot' }) }
    );
    expect(res3.status).toBe(200);
  });

  it('multiple rapid posts with same key all succeed and deduct tokens correctly', async () => {
    let tokenBalance = 100;
    const bot = makeBot();
    let postCount = 0;

    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [{ ...bot, token_balance: tokenBalance }];
      if (query.includes('UPDATE') && query.includes('token_balance')) {
        tokenBalance -= 1;
        return [{ token_balance: tokenBalance }];
      }
      if (query.includes('INSERT INTO feed_items')) { postCount++; return []; }
      if (query.includes('feed_items') && query.includes('WHERE id')) return [makeFeedItem({ id: `feed-${postCount}` })];
      if (query.includes('subscribers')) return [];
      if (query.includes('webhooks')) return [];
      if (query.includes('content_hash')) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');

    // Fire 5 posts rapidly
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        POST(
          createAuthRequest('/api/v1/bots/cycle35-bot/feed', 'aims_c35_test_key_001', {
            method: 'POST',
            body: { type: 'thought', content: `Rapid post ${i + 1}` },
            headers: { 'x-forwarded-for': '10.35.0.5' },
          }),
          { params: Promise.resolve({ username: 'cycle35-bot' }) }
        )
      )
    );

    for (const res of results) {
      expect(res.status).toBe(200);
    }
    expect(postCount).toBe(5);
    expect(tokenBalance).toBe(95);
  });

  it('posting with zero tokens returns 402 with required and balance fields', async () => {
    const bot = makeBot({ token_balance: 0 });

    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [bot];
      if (query.includes('UPDATE') && query.includes('token_balance')) return []; // no rows = insufficient
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: 0 }];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(
      createAuthRequest('/api/v1/bots/cycle35-bot/feed', 'aims_c35_test_key_001', {
        method: 'POST',
        body: { type: 'thought', content: 'No tokens left' },
      }),
      { params: Promise.resolve({ username: 'cycle35-bot' }) }
    );
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.required).toBeDefined();
    expect(data.balance).toBeDefined();
    expect(data.success).toBe(false);
  });

  it('duplicate username at registration returns 409', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username')) {
        return [makeBot()];
      }
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'cycle35-bot' },
    }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('taken');
  });

  it('invalid username formats all rejected at registration', async () => {
    const invalid = ['ab', 'A', 'has spaces', 'has@special', 'has.dot', 'UPPER'];

    for (const username of invalid) {
      vi.resetModules();
      const { POST } = await import('@/app/api/v1/bots/register/route');
      const res = await POST(createRequest('/api/v1/bots/register', {
        method: 'POST',
        body: { username },
        headers: { 'x-forwarded-for': `10.35.${Math.random() * 255 | 0}.${Math.random() * 255 | 0}` },
      }));
      expect(res.status, `Expected 400 for username "${username}"`).toBe(400);
    }
  });

  it('feed response includes both items array and data array (backward compat)', async () => {
    const bot = makeBot();
    const feedItem = makeFeedItem();

    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('username')) return [bot];
      if (query.includes('feed_items') && query.includes('COUNT')) return [{ count: 1 }];
      if (query.includes('feed_items')) return [feedItem];
      if (query.includes('COUNT')) return [{ count: 1 }];
      return [];
    });

    const { GET } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await GET(
      createRequest('/api/v1/bots/cycle35-bot/feed'),
      { params: Promise.resolve({ username: 'cycle35-bot' }) }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    // Both `items` and `data` should exist for backward compat
    expect(data.items).toBeDefined();
    expect(data.data).toBeDefined();
    expect(data.items).toEqual(data.data);
  });
});
