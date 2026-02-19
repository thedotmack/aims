import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
const mockGetDMById = vi.fn();
const mockSetTypingIndicator = vi.fn();
const mockClearTypingIndicator = vi.fn();
const mockGetTypingIndicators = vi.fn();

vi.mock('@/lib/db', () => ({
  getDMById: (...args: unknown[]) => mockGetDMById(...args),
  setTypingIndicator: (...args: unknown[]) => mockSetTypingIndicator(...args),
  clearTypingIndicator: (...args: unknown[]) => mockClearTypingIndicator(...args),
  getTypingIndicators: (...args: unknown[]) => mockGetTypingIndicators(...args),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminKey: () => false,
  verifyBotToken: vi.fn().mockResolvedValue({ username: 'bot-a', id: 'bot-1' }),
}));

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 29, limit: 30, reset: Date.now() + 60000 }),
  rateLimitHeaders: () => ({}),
  rateLimitResponse: () => new Response('Rate limited', { status: 429 }),
  LIMITS: { AUTH_WRITE: { name: 'AUTH_WRITE', limit: 30, window: 60 }, PUBLIC_READ: { name: 'PUBLIC_READ', limit: 100, window: 60 } },
  getClientIp: () => '127.0.0.1',
}));

vi.mock('@/lib/errors', () => ({
  handleApiError: (_err: unknown, _path: string, _method: string, headers: Record<string, string>) =>
    Response.json({ success: false, error: 'Internal error' }, { status: 500, headers }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { authFailure: vi.fn(), apiError: vi.fn() },
}));

const dm = { id: 'dm-1', bot1Username: 'bot-a', bot2Username: 'bot-b', createdAt: new Date().toISOString(), lastActivity: new Date().toISOString() };

describe('POST /api/v1/dms/[roomId]/typing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDMById.mockResolvedValue(dm);
    mockSetTypingIndicator.mockResolvedValue(undefined);
    mockClearTypingIndicator.mockResolvedValue(undefined);
  });

  async function postTyping(body: Record<string, unknown>) {
    const { POST } = await import('@/app/api/v1/dms/[roomId]/typing/route');
    const req = new Request('http://localhost/api/v1/dms/dm-1/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
      body: JSON.stringify(body),
    });
    return POST(req as never, { params: Promise.resolve({ roomId: 'dm-1' }) });
  }

  it('sets typing indicator for participant', async () => {
    const res = await postTyping({ username: 'bot-a', typing: true });
    expect(res.status).toBe(200);
    expect(mockSetTypingIndicator).toHaveBeenCalledWith('dm-1', 'bot-a');
  });

  it('clears typing indicator when typing=false', async () => {
    const res = await postTyping({ username: 'bot-a', typing: false });
    expect(res.status).toBe(200);
    expect(mockClearTypingIndicator).toHaveBeenCalledWith('dm-1', 'bot-a');
  });

  it('rejects missing username', async () => {
    const res = await postTyping({ typing: true });
    expect(res.status).toBe(400);
  });

  it('rejects non-participant', async () => {
    mockGetDMById.mockResolvedValue({ ...dm, bot1Username: 'other-bot', bot2Username: 'another-bot' });
    const res = await postTyping({ username: 'bot-a', typing: true });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent DM', async () => {
    mockGetDMById.mockResolvedValue(null);
    const res = await postTyping({ username: 'bot-a', typing: true });
    expect(res.status).toBe(404);
  });

  it('rejects impersonation (bot setting another bots typing)', async () => {
    const res = await postTyping({ username: 'bot-b', typing: true });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/dms/[roomId]/typing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDMById.mockResolvedValue(dm);
    mockGetTypingIndicators.mockResolvedValue(['bot-a']);
  });

  it('returns typing users', async () => {
    const { GET } = await import('@/app/api/v1/dms/[roomId]/typing/route');
    const req = new Request('http://localhost/api/v1/dms/dm-1/typing');
    const res = await GET(req as never, { params: Promise.resolve({ roomId: 'dm-1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.typing).toEqual(['bot-a']);
  });

  it('returns 404 for non-existent DM', async () => {
    mockGetDMById.mockResolvedValue(null);
    const { GET } = await import('@/app/api/v1/dms/[roomId]/typing/route');
    const req = new Request('http://localhost/api/v1/dms/dm-1/typing');
    const res = await GET(req as never, { params: Promise.resolve({ roomId: 'dm-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns empty array when nobody is typing', async () => {
    mockGetTypingIndicators.mockResolvedValue([]);
    const { GET } = await import('@/app/api/v1/dms/[roomId]/typing/route');
    const req = new Request('http://localhost/api/v1/dms/dm-1/typing');
    const res = await GET(req as never, { params: Promise.resolve({ roomId: 'dm-1' }) });
    const data = await res.json();
    expect(data.typing).toEqual([]);
  });
});
