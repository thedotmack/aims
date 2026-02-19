import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
vi.mock('@/lib/db', () => ({
  getAllChats: vi.fn().mockResolvedValue([
    { id: 'chat-1', title: 'Test Chat', lastActivity: '2026-01-01T00:00:00Z' },
  ]),
  getChatByKey: vi.fn().mockImplementation((key: string) => {
    if (key === 'test-key') {
      return Promise.resolve({ id: 'chat-1', key: 'test-key', title: 'Test Chat', createdAt: '2026-01-01T00:00:00Z', lastActivity: '2026-01-01T00:00:00Z' });
    }
    return Promise.resolve(null);
  }),
  getChatMessages: vi.fn().mockResolvedValue([]),
  getMessagesAfter: vi.fn().mockResolvedValue([]),
  createMessage: vi.fn().mockResolvedValue({ id: 'msg-1', chatId: 'chat-1', username: 'bot', content: 'hello', timestamp: '2026-01-01T00:00:00Z' }),
  createChat: vi.fn().mockResolvedValue({ id: 'chat-2', key: 'new-key', title: 'New Chat', createdAt: '2026-01-01T00:00:00Z' }),
}));

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 99, limit: 100, resetMs: 60000 }),
  rateLimitHeaders: vi.fn().mockReturnValue({}),
  rateLimitResponse: vi.fn(),
  LIMITS: { PUBLIC_READ: { name: 'PUBLIC_READ', maxRequests: 100, windowMs: 60000 }, AUTH_WRITE: { name: 'AUTH_WRITE', maxRequests: 30, windowMs: 60000 } },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/errors', () => ({
  handleApiError: vi.fn().mockReturnValue(new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })),
}));

vi.mock('@/lib/auth', () => ({
  validateUsername: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/webhooks', () => ({
  deliverWebhooks: vi.fn(),
}));

vi.mock('@/lib/validation', () => ({
  validateTextField: vi.fn().mockReturnValue({ valid: true, value: 'hello' }),
  sanitizeText: vi.fn((t: string) => t),
  MAX_LENGTHS: { TITLE: 200, CONTENT: 10000 },
}));

function makeRequest(url: string, options?: RequestInit) {
  return new Request(`http://localhost:3000${url}`, options);
}

describe('Chat API Deprecation Headers', () => {
  it('GET /api/v1/chats returns Deprecation and Sunset headers', async () => {
    const { GET } = await import('@/app/api/v1/chats/route');
    const res = await GET(makeRequest('/api/v1/chats'));
    expect(res.headers.get('Deprecation')).toBe('true');
    expect(res.headers.get('Sunset')).toBe('Wed, 30 Apr 2026 00:00:00 GMT');
    expect(res.headers.get('Link')).toContain('successor-version');
    const body = await res.json();
    expect(body._deprecated).toContain('Sunset: April 30, 2026');
  });

  it('GET /api/v1/chats/[key] returns deprecation headers', async () => {
    const { GET } = await import('@/app/api/v1/chats/[key]/route');
    const res = await GET(makeRequest('/api/v1/chats/test-key'), { params: Promise.resolve({ key: 'test-key' }) });
    expect(res.headers.get('Deprecation')).toBe('true');
    expect(res.headers.get('Sunset')).toBe('Wed, 30 Apr 2026 00:00:00 GMT');
    const body = await res.json();
    expect(body._deprecated).toContain('Sunset: April 30, 2026');
  });

  it('GET /api/v1/chats/[key] 404 still includes deprecation headers', async () => {
    const { GET } = await import('@/app/api/v1/chats/[key]/route');
    const res = await GET(makeRequest('/api/v1/chats/nonexistent'), { params: Promise.resolve({ key: 'nonexistent' }) });
    expect(res.status).toBe(404);
    expect(res.headers.get('Deprecation')).toBe('true');
    const body = await res.json();
    expect(body._deprecated).toContain('Sunset');
  });

  it('GET /api/v1/chats/[key]/messages returns deprecation headers', async () => {
    const { GET } = await import('@/app/api/v1/chats/[key]/messages/route');
    const res = await GET(makeRequest('/api/v1/chats/test-key/messages'), { params: Promise.resolve({ key: 'test-key' }) });
    expect(res.headers.get('Deprecation')).toBe('true');
    expect(res.headers.get('Sunset')).toBe('Wed, 30 Apr 2026 00:00:00 GMT');
    const body = await res.json();
    expect(body._deprecated).toContain('Sunset: April 30, 2026');
  });

  it('POST /api/v1/chats/[key]/messages returns deprecation headers', async () => {
    const { POST } = await import('@/app/api/v1/chats/[key]/messages/route');
    const res = await POST(
      makeRequest('/api/v1/chats/test-key/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testbot', content: 'hello' }),
      }),
      { params: Promise.resolve({ key: 'test-key' }) }
    );
    expect(res.status).toBe(201);
    expect(res.headers.get('Deprecation')).toBe('true');
    expect(res.headers.get('Sunset')).toBe('Wed, 30 Apr 2026 00:00:00 GMT');
    const body = await res.json();
    expect(body._deprecated).toContain('Sunset: April 30, 2026');
  });

  it('Sunset date is April 30, 2026 across all endpoints', async () => {
    const sunsetDate = 'Wed, 30 Apr 2026 00:00:00 GMT';
    
    const { GET: getChats } = await import('@/app/api/v1/chats/route');
    const res1 = await getChats(makeRequest('/api/v1/chats'));
    expect(res1.headers.get('Sunset')).toBe(sunsetDate);

    const { GET: getChat } = await import('@/app/api/v1/chats/[key]/route');
    const res2 = await getChat(makeRequest('/api/v1/chats/test-key'), { params: Promise.resolve({ key: 'test-key' }) });
    expect(res2.headers.get('Sunset')).toBe(sunsetDate);

    const { GET: getMessages } = await import('@/app/api/v1/chats/[key]/messages/route');
    const res3 = await getMessages(makeRequest('/api/v1/chats/test-key/messages'), { params: Promise.resolve({ key: 'test-key' }) });
    expect(res3.headers.get('Sunset')).toBe(sunsetDate);
  });

  it('Link header points to successor API and migration docs', async () => {
    const { GET } = await import('@/app/api/v1/chats/route');
    const res = await GET(makeRequest('/api/v1/chats'));
    const link = res.headers.get('Link');
    expect(link).toContain('/api/v1/dms');
    expect(link).toContain('rel="successor-version"');
    expect(link).toContain('chat-migration');
    expect(link).toContain('rel="deprecation"');
  });
});
