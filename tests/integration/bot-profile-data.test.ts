import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
vi.mock('@/lib/db', () => ({
  getBotByUsername: vi.fn((username: string) => {
    if (username === 'active-bot') {
      return {
        username: 'active-bot',
        displayName: 'Active Bot',
        apiKey: 'aims_secret123',
        avatarUrl: null,
        statusMessage: 'thinking...',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        tokenBalance: 85,
        keyCreatedAt: new Date().toISOString(),
        webhookUrl: 'https://example.com/hook',
      };
    }
    return null;
  }),
}));

vi.mock('@/lib/auth', () => ({
  verifyBotToken: vi.fn(async (request: Request) => {
    const auth = request.headers.get('authorization');
    if (auth === 'Bearer aims_secret123') return { username: 'active-bot' };
    return null;
  }),
  validateAdminKey: vi.fn(() => false),
}));

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimitAsync: vi.fn(() => ({ allowed: true, remaining: 99, limit: 100, reset: Date.now() + 60000 })),
  rateLimitHeaders: vi.fn(() => ({})),
  rateLimitResponse: vi.fn(() => new Response('Rate limited', { status: 429 })),
  LIMITS: { PUBLIC_READ: { name: 'public', window: 60, max: 100 } },
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/errors', () => ({
  handleApiError: vi.fn(() => Response.json({ error: 'Internal' }, { status: 500 })),
}));

describe('Bot profile API', () => {
  it('GET /bots/:username returns public bot data', async () => {
    const { GET } = await import('@/app/api/v1/bots/[username]/route');
    const req = new Request('http://localhost/api/v1/bots/active-bot');
    const res = await GET(req as any, { params: Promise.resolve({ username: 'active-bot' }) });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.bot.username).toBe('active-bot');
    expect(data.bot.displayName).toBe('Active Bot');
    expect(data.bot.isOnline).toBe(true);
    // Public response should NOT include apiKey
    expect(data.bot.apiKey).toBeUndefined();
    // Non-owner should NOT see webhookUrl or keyCreatedAt
    expect(data.bot.webhookUrl).toBeUndefined();
    expect(data.bot.keyCreatedAt).toBeUndefined();
  });

  it('GET /bots/:username returns 404 for unknown bot', async () => {
    const { GET } = await import('@/app/api/v1/bots/[username]/route');
    const req = new Request('http://localhost/api/v1/bots/nobody');
    const res = await GET(req as any, { params: Promise.resolve({ username: 'nobody' }) });
    expect(res.status).toBe(404);
  });

  it('GET /bots/:username shows owner-only fields when authenticated as owner', async () => {
    const { GET } = await import('@/app/api/v1/bots/[username]/route');
    const req = new Request('http://localhost/api/v1/bots/active-bot', {
      headers: { 'Authorization': 'Bearer aims_secret123' },
    });
    const res = await GET(req as any, { params: Promise.resolve({ username: 'active-bot' }) });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.bot.keyCreatedAt).toBeDefined();
    expect(data.bot.webhookUrl).toBeDefined();
  });

  it('GET /bots/:username hides owner fields from non-owners', async () => {
    const { GET } = await import('@/app/api/v1/bots/[username]/route');
    const req = new Request('http://localhost/api/v1/bots/active-bot', {
      headers: { 'Authorization': 'Bearer aims_wrongkey' },
    });
    const res = await GET(req as any, { params: Promise.resolve({ username: 'active-bot' }) });
    const data = await res.json();
    expect(data.bot.keyCreatedAt).toBeUndefined();
    expect(data.bot.webhookUrl).toBeUndefined();
  });
});

describe('Bot badges computation', () => {
  // Already covered in tests/lib/badges.test.ts - this verifies integration
  it('computeBadges is a pure function that can be used server-side', async () => {
    const { computeBadges } = await import('@/lib/badges');
    const badges = computeBadges({
      botCreatedAt: new Date().toISOString(),
      feedStats: { thought: 150, observation: 50 },
      followerCount: 3,
      botRank: 5,
      totalBots: 50,
      botPosition: 8,
    });
    // Should get early-adopter (pos 8) and deep-thinker (150 thoughts)
    const ids = badges.map(b => b.id);
    expect(ids).toContain('early-adopter');
    expect(ids).toContain('deep-thinker');
    expect(ids).not.toContain('power-user'); // only 200 total, need 500
  });
});

describe('Bot personality computation', () => {
  it('computes personality from feed items', async () => {
    const { computePersonality } = await import('@/lib/personality');
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `fi_${i}`,
      botUsername: 'test',
      feedType: 'thought' as const,
      title: '',
      content: 'analyze data patterns and evaluate metrics to understand the system',
      metadata: null,
      createdAt: new Date().toISOString(),
      replyTo: null,
      chainHash: null,
      chainTx: null,
      sourceType: null,
      contentHash: null,
    }));
    const personality = computePersonality(items as any);
    expect(personality.dominantType).toBe('thought');
    expect(personality.traits.length).toBeGreaterThan(0);
    expect(personality.summary).toContain('reflective');
  });
});
