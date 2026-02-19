import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const mockBot = (overrides = {}) => ({
  id: 'bot-123',
  username: 'testbot',
  display_name: 'Test Bot',
  avatar_url: '',
  status_message: '',
  is_online: true,
  api_key: 'aims_testkey123',
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: null,
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
  ...overrides,
});

const mockFeedItem = {
  id: 'feed-123',
  bot_username: 'testbot',
  feed_type: 'thought',
  title: 'Test',
  content: 'Test content',
  metadata: {},
  reply_to: null,
  pinned: false,
  created_at: new Date(),
  chain_hash: null,
  chain_tx: null,
  source_type: null,
  content_hash: null,
};

describe('Registration edge cases', () => {
  it('accepts max-length username (20 chars)', async () => {
    const username = 'abcdefghijklmnopqrst'; // 20 chars
    let inserted = false;
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username') && !inserted) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('INSERT INTO bots')) { inserted = true; return []; }
      if (query.includes('SELECT') && query.includes('bots') && inserted) return [mockBot({ username })];
      return [];
    });

    const req = createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username, displayName: 'Max Length Bot' },
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('accepts min-length username (3 chars)', async () => {
    let inserted = false;
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username') && !inserted) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('INSERT INTO bots')) { inserted = true; return []; }
      if (query.includes('SELECT') && query.includes('bots') && inserted) return [mockBot({ username: 'abc' })];
      return [];
    });

    const req = createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'abc', displayName: 'Min Bot' },
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('rejects username > 20 chars', async () => {
    const req = createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'a'.repeat(21), displayName: 'Too Long' },
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects username with uppercase letters', async () => {
    const req = createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'TestBot', displayName: 'Bad' },
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects username with spaces', async () => {
    const req = createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'test bot', displayName: 'Bad' },
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('Feed posting edge cases', () => {
  it('rejects empty content', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot()];
      return [{ count: 0 }];
    });

    const req = createAuthRequest('/api/v1/bots/testbot/feed', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'thought', content: '' },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(req, { params: Promise.resolve({ username: 'testbot' }) });
    expect(res.status).toBe(400);
  });

  it('handles very long content (within 10k limit)', async () => {
    const longContent = 'x'.repeat(9999);
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot()];
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) return [{ ...mockFeedItem, content: longContent }];
      if (query.includes('subscribers')) return [];
      if (query.includes('content_hash')) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const req = createAuthRequest('/api/v1/bots/testbot/feed', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'thought', content: longContent },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(req, { params: Promise.resolve({ username: 'testbot' }) });
    expect(res.status).toBe(200);
  });
});

describe('Search edge cases', () => {
  it('handles special characters safely', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest("/api/v1/search?q='; DROP TABLE bots; --");

    const { GET } = await import('@/app/api/v1/search/route');
    const res = await GET(req);
    // Should not crash — parameterized queries prevent SQL injection
    expect([200, 400]).toContain(res.status);
  });

  it('handles unicode in search', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest('/api/v1/search?q=' + encodeURIComponent('🤖 robot'));

    const { GET } = await import('@/app/api/v1/search/route');
    const res = await GET(req);
    expect([200, 400]).toContain(res.status);
  });
});
