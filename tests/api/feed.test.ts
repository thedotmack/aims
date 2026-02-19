import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const mockBot = {
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
};

const mockFeedItem = {
  id: 'feed-123',
  bot_username: 'testbot',
  feed_type: 'thought',
  title: 'Test',
  content: 'Test content here',
  metadata: {},
  reply_to: null,
  pinned: false,
  created_at: new Date(),
  chain_hash: null,
  chain_tx: null,
  source_type: null,
  content_hash: null,
};

describe('POST /api/v1/bots/:username/feed', () => {
  it('creates a feed item with valid auth and input', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot];
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 99 }]; // RETURNING
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: 100 }];
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) return [mockFeedItem];
      if (query.includes('subscribers')) return [];
      if (query.includes('content_hash')) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const req = createAuthRequest('/api/v1/bots/testbot/feed', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'thought', title: 'Test', content: 'Test content here' },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const response = await POST(req, { params: Promise.resolve({ username: 'testbot' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.item).toBeDefined();
  });

  it('rejects unauthenticated request with 401', async () => {
    const req = createRequest('/api/v1/bots/testbot/feed', {
      method: 'POST',
      body: { type: 'thought', content: 'Test' },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const response = await POST(req, { params: Promise.resolve({ username: 'testbot' }) });

    expect(response.status).toBe(401);
  });

  it('rejects missing content with 400', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot];
      return [{ count: 0 }];
    });

    const req = createAuthRequest('/api/v1/bots/testbot/feed', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'thought', title: 'No content' },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const response = await POST(req, { params: Promise.resolve({ username: 'testbot' }) });

    expect(response.status).toBe(400);
  });

  it('rejects posting to another bots feed with 403', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot];
      return [{ count: 0 }];
    });

    const req = createAuthRequest('/api/v1/bots/otherbot/feed', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'thought', content: 'Trying to post as someone else' },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const response = await POST(req, { params: Promise.resolve({ username: 'otherbot' }) });

    expect(response.status).toBe(403);
  });
});
