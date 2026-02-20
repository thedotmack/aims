import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const API_KEY = 'aims_token_test_key';

function makeBot(balance: number) {
  return {
    id: 'bot-token-001',
    username: 'token-test-bot',
    display_name: 'Token Test Bot',
    avatar_url: '',
    status_message: '',
    is_online: false,
    api_key: API_KEY,
    webhook_url: null,
    key_created_at: new Date(),
    ip_address: '127.0.0.1',
    created_at: new Date(),
    last_seen: new Date(),
    token_balance: balance,
  };
}

function makeFeedItem(id: string) {
  return {
    id,
    bot_username: 'token-test-bot',
    feed_type: 'thought',
    title: 'Test',
    content: 'Hello',
    metadata: '{}',
    reply_to: null,
    pinned: false,
    created_at: new Date(),
    chain_hash: null,
    chain_tx: null,
    source_type: null,
    content_hash: null,
  };
}

describe('Token Economy Lifecycle', () => {
  it('bot with 100 tokens posts to feed → balance decreases to 99', async () => {
    let currentBalance = 100;

    setAllQueriesHandler((query) => {
      // Auth: lookup by API key
      if (query.includes('bots') && query.includes('api_key')) return [makeBot(currentBalance)];
      // Deduct tokens for feed post (1 $AIMS)
      if (query.includes('UPDATE bots SET token_balance')) {
        if (currentBalance >= 1) {
          currentBalance -= 1;
          return [{ token_balance: currentBalance }];
        }
        return [];
      }
      // Feed item insert
      if (query.includes('INSERT INTO feed_items')) return [];
      // Feed item select after insert
      if (query.includes('feed_items') && query.includes('WHERE id')) return [makeFeedItem('feed-001')];
      // Webhooks/subscribers
      if (query.includes('subscribers')) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      // Get token balance
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: currentBalance }];
      return [];
    });

    // Post to feed (costs 1 $AIMS) — bot starts with 100 tokens from signup
    const feedReq = createAuthRequest('/api/v1/bots/token-test-bot/feed', API_KEY, {
      method: 'POST',
      body: { type: 'thought', content: 'My first post' },
    });
    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const feedRes = await POST(feedReq, { params: Promise.resolve({ username: 'token-test-bot' }) });
    expect(feedRes.status).toBe(200);

    // Verify balance decreased from 100 → 99
    expect(currentBalance).toBe(99);
  });

  it('register → send DM → balance decreases by 2', async () => {
    let currentBalance = 100;
    const dmRow = { id: 'dm-001', bot1_username: 'token-test-bot', bot2_username: 'other-bot', created_at: new Date(), last_activity: new Date() };

    setAllQueriesHandler((query, values) => {
      // Auth: getBotByApiKey
      if (query.includes('bots') && query.includes('api_key')) return [makeBot(currentBalance)];
      // getBotByUsername
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username') && !query.includes('api_key') && !query.includes('token_balance')) return [makeBot(currentBalance)];
      // DM lookup
      if (query.includes('SELECT') && query.includes('dms')) return [dmRow];
      // Deduct 2 tokens for DM
      if (query.includes('UPDATE bots SET token_balance')) {
        if (currentBalance >= 2) {
          currentBalance -= 2;
          return [{ token_balance: currentBalance }];
        }
        return [];
      }
      // Insert message
      if (query.includes('INSERT INTO messages')) return [];
      // Select message after insert
      if (query.includes('messages') && query.includes('WHERE id')) {
        return [{
          id: 'msg-001', dm_id: 'dm-001', from_username: 'token-test-bot',
          username: 'token-test-bot', content: 'Hello', is_bot: true, created_at: new Date(),
        }];
      }
      // Update DM activity
      if (query.includes('UPDATE dms')) return [];
      // Clear typing
      if (query.includes('DELETE') && query.includes('typing_indicators')) return [];
      // Get balance
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: currentBalance }];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const req = createAuthRequest('/api/v1/dms/dm-001/messages', API_KEY, {
      method: 'POST',
      body: { from: 'token-test-bot', content: 'Hello from DM' },
    });
    const { POST } = await import('@/app/api/v1/dms/[roomId]/messages/route');
    const res = await POST(req, { params: Promise.resolve({ roomId: 'dm-001' }) });
    expect(res.status).toBe(200);
    expect(currentBalance).toBe(98);
  });

  it('posts until tokens exhausted, then gets 402', async () => {
    let currentBalance = 2; // Only enough for 2 feed posts

    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [makeBot(currentBalance)];
      if (query.includes('UPDATE bots SET token_balance')) {
        if (currentBalance >= 1) {
          currentBalance -= 1;
          return [{ token_balance: currentBalance }];
        }
        return []; // insufficient
      }
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) return [makeFeedItem('feed-x')];
      if (query.includes('subscribers')) return [];
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: currentBalance }];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');

    // Post 1: should succeed (balance 2 → 1)
    const req1 = createAuthRequest('/api/v1/bots/token-test-bot/feed', API_KEY, {
      method: 'POST',
      body: { type: 'thought', content: 'Post 1' },
    });
    const res1 = await POST(req1, { params: Promise.resolve({ username: 'token-test-bot' }) });
    expect(res1.status).toBe(200);
    expect(currentBalance).toBe(1);

    // Post 2: should succeed (balance 1 → 0)
    const req2 = createAuthRequest('/api/v1/bots/token-test-bot/feed', API_KEY, {
      method: 'POST',
      body: { type: 'thought', content: 'Post 2' },
    });
    const res2 = await POST(req2, { params: Promise.resolve({ username: 'token-test-bot' }) });
    expect(res2.status).toBe(200);
    expect(currentBalance).toBe(0);

    // Post 3: should fail with 402
    const req3 = createAuthRequest('/api/v1/bots/token-test-bot/feed', API_KEY, {
      method: 'POST',
      body: { type: 'thought', content: 'Post 3 - should fail' },
    });
    const res3 = await POST(req3, { params: Promise.resolve({ username: 'token-test-bot' }) });
    const data3 = await res3.json();
    expect(res3.status).toBe(402);
    expect(data3.required).toBe(1);
    expect(data3.balance).toBe(0);
  });

  it('DM costs 2 tokens, not 1', async () => {
    let currentBalance = 3;
    const dmRow = { id: 'dm-002', bot1_username: 'token-test-bot', bot2_username: 'other', created_at: new Date(), last_activity: new Date() };

    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [makeBot(currentBalance)];
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username') && !query.includes('api_key') && !query.includes('token_balance')) return [makeBot(currentBalance)];
      if (query.includes('SELECT') && query.includes('dms')) return [dmRow];
      if (query.includes('UPDATE bots SET token_balance')) {
        if (currentBalance >= 2) {
          currentBalance -= 2;
          return [{ token_balance: currentBalance }];
        }
        return [];
      }
      if (query.includes('INSERT INTO messages')) return [];
      if (query.includes('messages') && query.includes('WHERE id')) {
        return [{ id: 'msg-x', dm_id: 'dm-002', from_username: 'token-test-bot', username: 'token-test-bot', content: 'Hi', is_bot: true, created_at: new Date() }];
      }
      if (query.includes('UPDATE dms')) return [];
      if (query.includes('DELETE') && query.includes('typing_indicators')) return [];
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: currentBalance }];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const { POST } = await import('@/app/api/v1/dms/[roomId]/messages/route');

    // First DM: 3 → 1
    const req1 = createAuthRequest('/api/v1/dms/dm-002/messages', API_KEY, {
      method: 'POST',
      body: { from: 'token-test-bot', content: 'DM 1' },
    });
    const res1 = await POST(req1, { params: Promise.resolve({ roomId: 'dm-002' }) });
    expect(res1.status).toBe(200);
    expect(currentBalance).toBe(1);

    // Second DM: balance 1 < cost 2 → 402
    const req2 = createAuthRequest('/api/v1/dms/dm-002/messages', API_KEY, {
      method: 'POST',
      body: { from: 'token-test-bot', content: 'DM 2 - should fail' },
    });
    const res2 = await POST(req2, { params: Promise.resolve({ roomId: 'dm-002' }) });
    const data2 = await res2.json();
    expect(res2.status).toBe(402);
    expect(data2.required).toBe(2);
    expect(data2.balance).toBe(1);
  });

  it('webhook ingest also deducts tokens', async () => {
    let currentBalance = 5;

    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [makeBot(currentBalance)];
      if (query.includes('UPDATE bots SET token_balance')) {
        if (currentBalance >= 1) {
          currentBalance -= 1;
          return [{ token_balance: currentBalance }];
        }
        return [];
      }
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) return [makeFeedItem('feed-wh')];
      if (query.includes('webhook_deliveries')) return [];
      if (query.includes('last_seen')) return [];
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: currentBalance }];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const req = createAuthRequest('/api/v1/webhooks/ingest', API_KEY, {
      method: 'POST',
      body: { type: 'observation', content: 'Observed something interesting' },
    });
    const { POST } = await import('@/app/api/v1/webhooks/ingest/route');
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(currentBalance).toBe(4);
  });

  it('new bot starts with 100 tokens (SIGNUP_BONUS constant)', async () => {
    const { TOKEN_COSTS } = await import('@/lib/db');
    expect(TOKEN_COSTS.SIGNUP_BONUS).toBe(100);
    expect(TOKEN_COSTS.FEED_POST).toBe(1);
    expect(TOKEN_COSTS.DM_MESSAGE).toBe(2);
  });
});
