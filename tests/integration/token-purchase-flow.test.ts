import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
const mockBots = new Map<string, { username: string; apiKey: string; tokenBalance: number }>();

vi.mock('@/lib/db', () => ({
  getBotByUsername: vi.fn((username: string) => {
    const bot = mockBots.get(username);
    return bot ? { ...bot, id: 'bot_1', api_key: bot.apiKey, token_balance: bot.tokenBalance } : null;
  }),
  getBotTokenBalance: vi.fn((username: string) => {
    const bot = mockBots.get(username);
    return bot ? bot.tokenBalance : 0;
  }),
  addTokens: vi.fn((username: string, amount: number) => {
    const bot = mockBots.get(username);
    if (bot) bot.tokenBalance += amount;
  }),
  deductTokens: vi.fn((username: string, amount: number) => {
    const bot = mockBots.get(username);
    if (!bot || bot.tokenBalance < amount) return false;
    bot.tokenBalance -= amount;
    return true;
  }),
  createFeedItem: vi.fn(async (botUsername: string, content: string, feedType: string) => {
    const bot = mockBots.get(botUsername);
    if (!bot || bot.tokenBalance < 1) {
      const { InsufficientTokensError } = await import('@/lib/db');
      throw new InsufficientTokensError(1, bot?.tokenBalance ?? 0);
    }
    bot.tokenBalance -= 1;
    return { id: 'fi_1', botUsername, content, feedType };
  }),
  createDMMessage: vi.fn(async (dmId: string, fromUsername: string, content: string) => {
    const bot = mockBots.get(fromUsername);
    if (!bot || bot.tokenBalance < 2) {
      const { InsufficientTokensError } = await import('@/lib/db');
      throw new InsufficientTokensError(2, bot?.tokenBalance ?? 0);
    }
    bot.tokenBalance -= 2;
    return { id: 'msg_1', dmId, fromUsername, content };
  }),
  TOKEN_COSTS: { FEED_POST: 1, DM_MESSAGE: 2, SIGNUP_BONUS: 100 },
  InsufficientTokensError: class InsufficientTokensError extends Error {
    required: number;
    balance: number;
    constructor(required: number, balance: number) {
      super(`Insufficient tokens: need ${required}, have ${balance}`);
      this.name = 'InsufficientTokensError';
      this.required = required;
      this.balance = balance;
    }
  },
  fireWebhooks: vi.fn(),
  getFeedItems: vi.fn(() => []),
  getFeedItemsPaginated: vi.fn(() => []),
  getFeedItemsCount: vi.fn(() => 0),
}));

vi.mock('@/lib/auth', () => ({
  verifyBotToken: vi.fn((req: Request) => {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    const key = auth.slice(7);
    for (const bot of mockBots.values()) {
      if (bot.apiKey === key) return { username: bot.username };
    }
    return null;
  }),
}));

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimitAsync: vi.fn(() => ({ allowed: true, remaining: 10, limit: 30, reset: Date.now() + 60000 })),
  rateLimitHeaders: vi.fn(() => ({})),
  rateLimitResponse: vi.fn(() => new Response('Rate limited', { status: 429 })),
  LIMITS: { PUBLIC_READ: { name: 'PUBLIC_READ', max: 100, window: 60000 }, AUTH_WRITE: { name: 'AUTH_WRITE', max: 30, window: 60000 } },
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/errors', () => ({
  handleApiError: vi.fn((err: Error) => Response.json({ error: 'Internal error' }, { status: 500 })),
}));

vi.mock('@/lib/validation', () => ({
  isValidFeedType: vi.fn((t: string) => ['thought', 'observation', 'action', 'summary'].includes(t)),
  getValidFeedTypes: vi.fn(() => ['thought', 'observation', 'action', 'summary']),
  validateTextField: vi.fn(() => null),
  sanitizeText: vi.fn((t: string) => t),
  MAX_LENGTHS: { CONTENT: 10000 },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/claude-mem', () => ({
  mapClaudeMemType: vi.fn(),
  enrichObservation: vi.fn(),
  contentHash: vi.fn(),
}));

describe('Token Purchase Flow: Full Lifecycle', () => {
  beforeEach(() => {
    mockBots.clear();
    mockBots.set('test-bot', { username: 'test-bot', apiKey: 'aims_test123', tokenBalance: 100 });
    mockBots.set('other-bot', { username: 'other-bot', apiKey: 'aims_other456', tokenBalance: 50 });
  });

  it('GET /tokens returns balance and costs', async () => {
    const { GET } = await import('@/app/api/v1/bots/[username]/tokens/route');
    const req = new Request('http://localhost/api/v1/bots/test-bot/tokens');
    const res = await GET(req as any, { params: Promise.resolve({ username: 'test-bot' }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.balance).toBe(100);
    expect(data.costs).toEqual({ FEED_POST: 1, DM_MESSAGE: 2, SIGNUP_BONUS: 100 });
  });

  it('GET /tokens returns 404 for unknown bot', async () => {
    const { GET } = await import('@/app/api/v1/bots/[username]/tokens/route');
    const req = new Request('http://localhost/api/v1/bots/nobody/tokens');
    const res = await GET(req as any, { params: Promise.resolve({ username: 'nobody' }) });
    expect(res.status).toBe(404);
  });

  it('POST /tokens adds tokens to balance', async () => {
    const { POST } = await import('@/app/api/v1/bots/[username]/tokens/route');
    const req = new Request('http://localhost/api/v1/bots/test-bot/tokens', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer aims_test123', 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50 }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ username: 'test-bot' }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.added).toBe(50);
    expect(data.balance).toBe(150);
  });

  it('POST /tokens rejects without auth', async () => {
    const { POST } = await import('@/app/api/v1/bots/[username]/tokens/route');
    const req = new Request('http://localhost/api/v1/bots/test-bot/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50 }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ username: 'test-bot' }) });
    expect(res.status).toBe(401);
  });

  it('POST /tokens rejects adding to another bot', async () => {
    const { POST } = await import('@/app/api/v1/bots/[username]/tokens/route');
    const req = new Request('http://localhost/api/v1/bots/other-bot/tokens', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer aims_test123', 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50 }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ username: 'other-bot' }) });
    expect(res.status).toBe(403);
  });

  it('POST /tokens rejects invalid amount (negative)', async () => {
    const { POST } = await import('@/app/api/v1/bots/[username]/tokens/route');
    const req = new Request('http://localhost/api/v1/bots/test-bot/tokens', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer aims_test123', 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: -10 }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ username: 'test-bot' }) });
    expect(res.status).toBe(400);
  });

  it('POST /tokens rejects amount over 10000', async () => {
    const { POST } = await import('@/app/api/v1/bots/[username]/tokens/route');
    const req = new Request('http://localhost/api/v1/bots/test-bot/tokens', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer aims_test123', 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 10001 }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ username: 'test-bot' }) });
    expect(res.status).toBe(400);
  });

  it('Full lifecycle: check balance → deplete via mock → buy tokens → balance restored', async () => {
    // Start with 0 tokens (simulating depletion)
    mockBots.set('lifecycle-bot', { username: 'lifecycle-bot', apiKey: 'aims_lifecycle', tokenBalance: 0 });

    const { GET, POST } = await import('@/app/api/v1/bots/[username]/tokens/route');

    // Check balance is 0
    let res = await GET(new Request('http://localhost/api/v1/bots/lifecycle-bot/tokens') as any, { params: Promise.resolve({ username: 'lifecycle-bot' }) });
    let data = await res.json();
    expect(data.balance).toBe(0);

    // Buy 50 tokens
    const buyReq = new Request('http://localhost/api/v1/bots/lifecycle-bot/tokens', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer aims_lifecycle', 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50 }),
    });
    const buyRes = await POST(buyReq as any, { params: Promise.resolve({ username: 'lifecycle-bot' }) });
    const buyData = await buyRes.json();
    expect(buyRes.status).toBe(200);
    expect(buyData.added).toBe(50);
    expect(buyData.balance).toBe(50);

    // Verify balance via GET
    res = await GET(new Request('http://localhost/api/v1/bots/lifecycle-bot/tokens') as any, { params: Promise.resolve({ username: 'lifecycle-bot' }) });
    data = await res.json();
    expect(data.balance).toBe(50);
  });
});
