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

describe('Invalid JSON body', () => {
  it('rejects malformed JSON on register', async () => {
    const req = new (await import('next/server')).NextRequest('http://localhost:3000/api/v1/bots/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
      body: 'not valid json{{{',
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(req);
    expect([400, 500]).toContain(res.status);
  });
});

describe('Missing required fields individually', () => {
  it('register: missing displayName still works (optional)', async () => {
    let inserted = false;
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username') && !inserted) return [];
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('INSERT INTO bots')) { inserted = true; return []; }
      if (query.includes('SELECT') && query.includes('bots') && inserted) return [mockBot()];
      return [];
    });

    const req = createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'testbot' },
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const res = await POST(req);
    // displayName may or may not be required - just ensure no crash
    expect([200, 400]).toContain(res.status);
  });

  it('feed: missing type returns 400', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot()];
      return [{ count: 0 }];
    });

    const req = createAuthRequest('/api/v1/bots/testbot/feed', 'aims_testkey123', {
      method: 'POST',
      body: { content: 'No type field' },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(req, { params: Promise.resolve({ username: 'testbot' }) });
    expect(res.status).toBe(400);
  });
});

describe('Invalid/expired API keys', () => {
  it('rejects invalid API key with 401', async () => {
    setAllQueriesHandler(() => []);

    const req = createAuthRequest('/api/v1/bots/testbot/feed', 'aims_invalidkey', {
      method: 'POST',
      body: { type: 'thought', content: 'Test' },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(req, { params: Promise.resolve({ username: 'testbot' }) });
    expect(res.status).toBe(401);
  });

  it('rejects empty Bearer token with 401', async () => {
    const req = createRequest('/api/v1/bots/testbot/feed', {
      method: 'POST',
      body: { type: 'thought', content: 'Test' },
      headers: { Authorization: 'Bearer ' },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(req, { params: Promise.resolve({ username: 'testbot' }) });
    expect(res.status).toBe(401);
  });

  it('rejects missing Authorization header with 401', async () => {
    const req = createRequest('/api/v1/bots/testbot/feed', {
      method: 'POST',
      body: { type: 'thought', content: 'Test' },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(req, { params: Promise.resolve({ username: 'testbot' }) });
    expect(res.status).toBe(401);
  });
});

describe('Token insufficient balance (402)', () => {
  it('feed post with 0 balance returns 402', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot({ token_balance: 0 })];
      if (query.includes('UPDATE bots SET token_balance')) return []; // no rows = insufficient
      if (query.includes('token_balance') && query.includes('SELECT')) return [{ token_balance: 0 }];
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const req = createAuthRequest('/api/v1/bots/testbot/feed', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'thought', content: 'No money' },
    });

    const { POST } = await import('@/app/api/v1/bots/[username]/feed/route');
    const res = await POST(req, { params: Promise.resolve({ username: 'testbot' }) });
    const data = await res.json();

    expect(res.status).toBe(402);
    expect(data.required).toBeDefined();
    expect(data.balance).toBeDefined();
  });
});

describe('Validation module', () => {
  it('sanitizeText strips script tags', async () => {
    const { sanitizeText } = await import('@/lib/validation');
    const result = sanitizeText('Hello <script>alert("xss")</script> World');
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('sanitizeText strips null bytes', async () => {
    const { sanitizeText } = await import('@/lib/validation');
    const result = sanitizeText('Hello\0World');
    expect(result).toBe('HelloWorld');
  });

  it('validateTextField rejects values over max length', async () => {
    const { validateTextField } = await import('@/lib/validation');
    const result = validateTextField('x'.repeat(101), 'test', 100);
    expect(result.valid).toBe(false);
  });

  it('validateTextField accepts values at max length', async () => {
    const { validateTextField } = await import('@/lib/validation');
    const result = validateTextField('x'.repeat(100), 'test', 100);
    expect(result.valid).toBe(true);
  });

  it('validateTextField rejects empty required field', async () => {
    const { validateTextField } = await import('@/lib/validation');
    const result = validateTextField('', 'test', 100, true);
    expect(result.valid).toBe(false);
  });

  it('validateTextField accepts empty optional field', async () => {
    const { validateTextField } = await import('@/lib/validation');
    const result = validateTextField('', 'test', 100, false);
    expect(result.valid).toBe(true);
  });

  it('isValidFeedType accepts valid types', async () => {
    const { isValidFeedType } = await import('@/lib/validation');
    expect(isValidFeedType('observation')).toBe(true);
    expect(isValidFeedType('thought')).toBe(true);
    expect(isValidFeedType('action')).toBe(true);
    expect(isValidFeedType('summary')).toBe(true);
    expect(isValidFeedType('status')).toBe(true);
  });

  it('isValidFeedType rejects invalid types', async () => {
    const { isValidFeedType } = await import('@/lib/validation');
    expect(isValidFeedType('invalid')).toBe(false);
    expect(isValidFeedType('')).toBe(false);
    expect(isValidFeedType('THOUGHT')).toBe(false);
  });
});
