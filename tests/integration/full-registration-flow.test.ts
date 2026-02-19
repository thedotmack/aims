import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const API_KEY = 'aims_integ_key_12345';

const makeBot = (overrides = {}) => ({
  id: 'bot-abc123',
  username: 'integration-bot',
  display_name: 'Integration Bot',
  avatar_url: '',
  status_message: '',
  is_online: false,
  api_key: API_KEY,
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: '127.0.0.1',
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
  ...overrides,
});

const makeFeedItem = (overrides = {}) => ({
  id: 'feed-item-001',
  bot_username: 'integration-bot',
  feed_type: 'thought',
  title: '',
  content: 'Hello from integration test',
  metadata: '{}',
  reply_to: null,
  chain_hash: null,
  chain_tx: null,
  source_type: 'api',
  content_hash: null,
  pinned: false,
  created_at: new Date(),
  ...overrides,
});

describe('Integration: Full Registration Flow', () => {
  it('register → get bot → post feed → verify in global feed → verify in bot feed', async () => {
    let registered = false;
    let feedItemCreated = false;
    const bot = makeBot();
    const feedItem = makeFeedItem();

    setAllQueriesHandler((query) => {
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('SELECT') && query.includes('bots') && !registered) return [];
      if (query.includes('INSERT INTO bots')) { registered = true; return []; }
      if (query.includes('SELECT') && query.includes('bots') && registered) return [bot];
      if (query.includes('UPDATE') && query.includes('token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) { feedItemCreated = true; return []; }
      if (query.includes('SELECT') && query.includes('feed_items') && feedItemCreated) return [feedItem];
      if (query.includes('SELECT') && query.includes('feed_items')) return [];
      if (query.includes('webhooks')) return [];
      return [];
    });

    // Step 1: Register
    const { POST: registerPOST } = await import('@/app/api/v1/bots/register/route');
    const regRes = await registerPOST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'integration-bot', displayName: 'Integration Bot' },
    }));
    const regData = await regRes.json();
    expect(regRes.status).toBe(200);
    expect(regData.success).toBe(true);
    expect(regData.api_key).toBeDefined();

    // Step 2: Get bot by username (public)
    const { GET: botGET } = await import('@/app/api/v1/bots/[username]/route');
    const botRes = await botGET(
      createRequest('/api/v1/bots/integration-bot'),
      { params: Promise.resolve({ username: 'integration-bot' }) }
    );
    const botData = await botRes.json();
    expect(botRes.status).toBe(200);
    expect(botData.bot.username).toBe('integration-bot');
    expect(botData.bot.api_key).toBeUndefined(); // stripped

    // Step 3: Post feed item
    const { POST: feedPOST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const feedRes = await feedPOST(
      createAuthRequest('/api/v1/bots/integration-bot/feed', API_KEY, {
        method: 'POST',
        body: { type: 'thought', content: 'Hello from integration test' },
      }),
      { params: Promise.resolve({ username: 'integration-bot' }) }
    );
    expect(feedRes.status).toBe(200);
    expect((await feedRes.json()).success).toBe(true);

    // Step 4: Verify in global feed
    const { GET: feedGET } = await import('@/app/api/v1/feed/route');
    const globalRes = await feedGET(createRequest('/api/v1/feed'));
    const globalData = await globalRes.json();
    expect(globalRes.status).toBe(200);
    expect(globalData.items.length).toBeGreaterThan(0);
    expect(globalData.items[0].content).toBe('Hello from integration test');

    // Step 5: Verify in bot feed
    const { GET: botFeedGET } = await import('@/app/api/v1/bots/[username]/feed/route');
    const botFeedRes = await botFeedGET(
      createRequest('/api/v1/bots/integration-bot/feed'),
      { params: Promise.resolve({ username: 'integration-bot' }) }
    );
    const botFeedData = await botFeedRes.json();
    expect(botFeedRes.status).toBe(200);
    expect(botFeedData.items.length).toBeGreaterThan(0);
  });

  it('registration gives 100 tokens, posting deducts 1, leaving 99', async () => {
    let tokenBalance = 100;
    let registered = false;
    const bot = makeBot();

    setAllQueriesHandler((query) => {
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('SELECT') && query.includes('bots') && !registered) return [];
      if (query.includes('INSERT INTO bots')) { registered = true; return []; }
      if (query.includes('SELECT') && query.includes('bots') && registered) {
        return [{ ...bot, token_balance: tokenBalance }];
      }
      if (query.includes('UPDATE') && query.includes('token_balance')) {
        tokenBalance -= 1;
        return [{ token_balance: tokenBalance }];
      }
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('webhooks')) return [];
      if (query.includes('feed_items')) return [makeFeedItem()];
      return [];
    });

    // Register
    const { POST: registerPOST } = await import('@/app/api/v1/bots/register/route');
    const regRes = await registerPOST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'integration-bot', displayName: 'Integration Bot' },
    }));
    expect(regRes.status).toBe(200);

    // Post feed item (costs 1 token)
    const { POST: feedPOST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const feedRes = await feedPOST(
      createAuthRequest('/api/v1/bots/integration-bot/feed', API_KEY, {
        method: 'POST',
        body: { type: 'thought', content: 'Token test' },
      }),
      { params: Promise.resolve({ username: 'integration-bot' }) }
    );
    expect(feedRes.status).toBe(200);
    expect(tokenBalance).toBe(99);
  });
});
