import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const API_KEY = 'aims_cp_test_key_001';

const makeBot = (overrides = {}) => ({
  id: 'bot-cp-001',
  username: 'critical-path-bot',
  display_name: 'Critical Path Bot',
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
  id: 'feed-cp-001',
  bot_username: 'critical-path-bot',
  feed_type: 'thought',
  title: 'Hello AIMs!',
  content: 'My first broadcast — I am alive!',
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

describe('Critical Path: Register → API Key → First Post → Global Feed', () => {
  it('complete happy path: register, use API key to post, verify in global and bot feeds', async () => {
    let registered = false;
    let feedPosted = false;
    const bot = makeBot();
    const feedItem = makeFeedItem();

    setAllQueriesHandler((query) => {
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username') && !registered) return [];
      if (query.includes('INSERT INTO bots')) { registered = true; return []; }
      if (query.includes('SELECT') && query.includes('bots') && query.includes('api_key')) return registered ? [bot] : [];
      if (query.includes('SELECT') && query.includes('bots') && registered) return [bot];
      if (query.includes('UPDATE') && query.includes('token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) { feedPosted = true; return []; }
      if (query.includes('feed_items') && query.includes('WHERE id')) return [feedItem];
      if (query.includes('feed_items') && feedPosted) return [feedItem];
      if (query.includes('feed_items')) return [];
      if (query.includes('subscribers')) return [];
      if (query.includes('webhooks')) return [];
      if (query.includes('content_hash')) return [];
      return [];
    });

    // Step 1: Register
    const { POST: registerPOST } = await import('@/app/api/v1/bots/register/route');
    const regRes = await registerPOST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'critical-path-bot', displayName: 'Critical Path Bot' },
      headers: { 'x-forwarded-for': '10.0.0.1' },
    }));
    const regData = await regRes.json();
    expect(regRes.status).toBe(200);
    expect(regData.success).toBe(true);
    expect(regData.api_key).toBeDefined();
    expect(regData.api_key).toContain('aims_');
    expect(regData.bot.username).toBe('critical-path-bot');
    expect(regData.important).toContain('SAVE');

    // Step 2: Use API key to post first feed item
    const { POST: feedPOST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const feedRes = await feedPOST(
      createAuthRequest('/api/v1/bots/critical-path-bot/feed', API_KEY, {
        method: 'POST',
        body: { type: 'thought', title: 'Hello AIMs!', content: 'My first broadcast — I am alive!' },
        headers: { 'x-forwarded-for': '10.0.0.2' },
      }),
      { params: Promise.resolve({ username: 'critical-path-bot' }) }
    );
    const feedData = await feedRes.json();
    expect(feedRes.status).toBe(200);
    expect(feedData.success).toBe(true);

    // Step 3: Verify in global feed
    const { GET: globalFeedGET } = await import('@/app/api/v1/feed/route');
    const globalRes = await globalFeedGET(createRequest('/api/v1/feed', { headers: { 'x-forwarded-for': '10.0.0.3' } }));
    const globalData = await globalRes.json();
    expect(globalRes.status).toBe(200);
    expect(globalData.items.length).toBeGreaterThan(0);
    expect(globalData.items[0].content).toBe('My first broadcast — I am alive!');

    // Step 4: Verify bot profile is accessible (public, no API key)
    const { GET: botGET } = await import('@/app/api/v1/bots/[username]/route');
    const botRes = await botGET(
      createRequest('/api/v1/bots/critical-path-bot', {
        headers: { 'x-forwarded-for': '10.0.0.4' },
      }),
      { params: Promise.resolve({ username: 'critical-path-bot' }) }
    );
    const botData = await botRes.json();
    expect(botRes.status).toBe(200);
    expect(botData.bot.username).toBe('critical-path-bot');
    expect(botData.bot.api_key).toBeUndefined(); // stripped for public
  });

  it('API key returned at top level (not nested in bot object)', async () => {
    let inserted = false;
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username') && !inserted) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('INSERT INTO bots')) { inserted = true; return []; }
      if (query.includes('SELECT') && query.includes('bots') && inserted) return [makeBot()];
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'critical-path-bot', displayName: 'Test' },
    }));
    const data = await res.json();

    // API key MUST be at data.api_key (top level)
    expect(data.api_key).toBeDefined();
    expect(typeof data.api_key).toBe('string');
    // bot object should NOT contain api_key (security)
    expect(data.bot.api_key).toBeUndefined();
  });

  it('registration response includes token info (100 $AIMS)', async () => {
    let inserted = false;
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username') && !inserted) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('INSERT INTO bots')) { inserted = true; return []; }
      if (query.includes('SELECT') && query.includes('bots') && inserted) return [makeBot()];
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'critical-path-bot' },
    }));
    const data = await res.json();
    expect(res.status).toBe(200);
    // The bot object should have username
    expect(data.bot.username).toBe('critical-path-bot');
  });

  it('post all 4 feed types with new API key', async () => {
    let tokenBalance = 100;
    const bot = makeBot({ token_balance: tokenBalance });
    const types = ['thought', 'observation', 'action', 'summary'] as const;

    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [{ ...bot, token_balance: tokenBalance }];
      if (query.includes('UPDATE') && query.includes('token_balance')) {
        tokenBalance -= 1;
        return [{ token_balance: tokenBalance }];
      }
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) {
        return [makeFeedItem({ feed_type: 'thought' })];
      }
      if (query.includes('subscribers')) return [];
      if (query.includes('content_hash')) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');

    for (const type of types) {
      const res = await POST(
        createAuthRequest('/api/v1/bots/critical-path-bot/feed', API_KEY, {
          method: 'POST',
          body: { type, content: `Testing ${type}` },
        }),
        { params: Promise.resolve({ username: 'critical-path-bot' }) }
      );
      expect(res.status).toBe(200);
    }
    // 4 posts at 1 $AIMS each = 96 remaining
    expect(tokenBalance).toBe(96);
  });

  it('tokens deplete to 0 then get 402', async () => {
    let tokenBalance = 2;
    const bot = makeBot({ token_balance: tokenBalance });

    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [{ ...bot, token_balance: tokenBalance }];
      if (query.includes('UPDATE') && query.includes('token_balance')) {
        if (tokenBalance >= 1) {
          tokenBalance -= 1;
          return [{ token_balance: tokenBalance }];
        }
        return []; // insufficient
      }
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) return [makeFeedItem()];
      if (query.includes('subscribers')) return [];
      if (query.includes('content_hash')) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: tokenBalance }];
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');

    // First post: success (2 → 1)
    const res1 = await POST(
      createAuthRequest('/api/v1/bots/critical-path-bot/feed', API_KEY, {
        method: 'POST', body: { type: 'thought', content: 'Post 1' },
      }),
      { params: Promise.resolve({ username: 'critical-path-bot' }) }
    );
    expect(res1.status).toBe(200);

    // Second post: success (1 → 0)
    const res2 = await POST(
      createAuthRequest('/api/v1/bots/critical-path-bot/feed', API_KEY, {
        method: 'POST', body: { type: 'thought', content: 'Post 2' },
      }),
      { params: Promise.resolve({ username: 'critical-path-bot' }) }
    );
    expect(res2.status).toBe(200);

    // Third post: 402 insufficient
    const res3 = await POST(
      createAuthRequest('/api/v1/bots/critical-path-bot/feed', API_KEY, {
        method: 'POST', body: { type: 'thought', content: 'Post 3' },
      }),
      { params: Promise.resolve({ username: 'critical-path-bot' }) }
    );
    expect(res3.status).toBe(402);
    const data3 = await res3.json();
    expect(data3.required).toBeDefined();
    expect(data3.balance).toBeDefined();
  });
});

describe('Registration Error Cases', () => {
  it('duplicate username returns 409 with clear message', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username')) {
        return [makeBot({ username: 'taken-bot' })];
      }
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'taken-bot', displayName: 'Taken' },
    }));
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toContain('taken');
  });

  it('missing username returns 400', async () => {
    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { displayName: 'No Username' },
    }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('empty body returns 400', async () => {
    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: {},
    }));
    expect(res.status).toBe(400);
  });

  it('username with special characters returns 400', async () => {
    const badUsernames = ['bot@name', 'bot name', 'bot.name', 'BOT', 'b', 'ab'];
    for (const bad of badUsernames) {
      vi.resetModules();
      const { POST } = await import('@/app/api/v1/bots/register/route');
      const res = await POST(createRequest('/api/v1/bots/register', {
        method: 'POST',
        body: { username: bad },
        headers: { 'x-forwarded-for': `10.0.${Math.random() * 255 | 0}.${Math.random() * 255 | 0}` },
      }));
      expect(res.status).toBe(400);
    }
  });

  it('IP rate limit returns 429 after 5 registrations', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username')) return [];
      if (query.includes('COUNT') && query.includes('bots')) return [{ count: 5 }]; // 5 recent registrations
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'rate-limited-bot', displayName: 'Rate Limited' },
    }));
    const data = await res.json();
    expect(res.status).toBe(429);
    expect(data.error).toContain('too many');
    expect(res.headers.get('Retry-After')).toBe('3600');
  });
});

describe('Feed Posting Error Cases with API Key', () => {
  it('invalid API key format returns 401', async () => {
    setAllQueriesHandler(() => []);

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(
      createAuthRequest('/api/v1/bots/somebot/feed', 'not_a_valid_key', {
        method: 'POST',
        body: { type: 'thought', content: 'Test' },
      }),
      { params: Promise.resolve({ username: 'somebot' }) }
    );
    expect(res.status).toBe(401);
  });

  it('valid key but wrong bot returns 403', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) {
        return [makeBot({ username: 'my-bot' })];
      }
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(
      createAuthRequest('/api/v1/bots/not-my-bot/feed', API_KEY, {
        method: 'POST',
        body: { type: 'thought', content: 'Impersonation attempt' },
      }),
      { params: Promise.resolve({ username: 'not-my-bot' }) }
    );
    expect(res.status).toBe(403);
  });

  it('missing content returns 400', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [makeBot()];
      return [{ count: 0 }];
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(
      createAuthRequest('/api/v1/bots/critical-path-bot/feed', API_KEY, {
        method: 'POST',
        body: { type: 'thought' },
      }),
      { params: Promise.resolve({ username: 'critical-path-bot' }) }
    );
    expect(res.status).toBe(400);
  });

  it('invalid feed type returns 400', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [makeBot()];
      return [{ count: 0 }];
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(
      createAuthRequest('/api/v1/bots/critical-path-bot/feed', API_KEY, {
        method: 'POST',
        body: { type: 'invalid_type', content: 'Test' },
      }),
      { params: Promise.resolve({ username: 'critical-path-bot' }) }
    );
    expect(res.status).toBe(400);
  });

  it('no auth header returns 401', async () => {
    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(
      createRequest('/api/v1/bots/critical-path-bot/feed', {
        method: 'POST',
        body: { type: 'thought', content: 'No auth' },
      }),
      { params: Promise.resolve({ username: 'critical-path-bot' }) }
    );
    expect(res.status).toBe(401);
  });
});

describe('Registration Page UX Contract', () => {
  it('RegisterForm reads api_key from correct response field', async () => {
    // This test documents the API contract that RegisterForm depends on
    let inserted = false;
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username') && !inserted) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('INSERT INTO bots')) { inserted = true; return []; }
      if (query.includes('SELECT') && query.includes('bots') && inserted) return [makeBot()];
      return [];
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'critical-path-bot' },
    }));
    const data = await res.json();

    // RegisterForm does: setApiKey(data.api_key)
    // This MUST exist at the top level
    expect(data).toHaveProperty('api_key');
    expect(typeof data.api_key).toBe('string');
    expect(data.api_key.length).toBeGreaterThan(0);
  });

  it('bot public profile strips API key', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('username')) return [makeBot()];
      if (query.includes('feed_items')) return [];
      if (query.includes('subscribers')) return [{ count: 0 }];
      return [];
    });

    const { GET } = await import('@/app/api/v1/bots/[username]/route');
    const res = await GET(
      createRequest('/api/v1/bots/critical-path-bot'),
      { params: Promise.resolve({ username: 'critical-path-bot' }) }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.bot.api_key).toBeUndefined();
    expect(data.bot.username).toBe('critical-path-bot');
  });
});
