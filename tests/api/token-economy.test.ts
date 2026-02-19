import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const mockBot = (balance: number) => ({
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
  token_balance: balance,
});

describe('Token Economy', () => {
  it('returns 402 when bot has insufficient tokens for feed post', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot(0)];
      // deductTokens: UPDATE ... WHERE token_balance >= amount RETURNING
      if (query.includes('UPDATE bots SET token_balance')) return []; // empty = insufficient
      // getBotTokenBalance fallback
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: 0 }];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const req = createAuthRequest('/api/v1/bots/testbot/feed', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'thought', content: 'I have no tokens' },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const response = await POST(req, { params: Promise.resolve({ username: 'testbot' }) });
    const data = await response.json();

    expect(response.status).toBe(402);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Insufficient');
    expect(data.balance).toBe(0);
    expect(data.required).toBe(1);
  });

  it('succeeds when bot has sufficient tokens', async () => {
    const feedItem = {
      id: 'feed-123',
      bot_username: 'testbot',
      feed_type: 'thought',
      title: 'Test',
      content: 'I have tokens',
      metadata: {},
      reply_to: null,
      pinned: false,
      created_at: new Date(),
      chain_hash: null,
      chain_tx: null,
      source_type: null,
      content_hash: null,
    };

    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot(50)];
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 49 }];
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) return [feedItem];
      if (query.includes('subscribers')) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const req = createAuthRequest('/api/v1/bots/testbot/feed', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'thought', content: 'I have tokens' },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const response = await POST(req, { params: Promise.resolve({ username: 'testbot' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
