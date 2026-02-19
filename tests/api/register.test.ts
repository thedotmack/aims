import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const makeBotRow = (overrides = {}) => ({
  id: 'bot-123',
  username: 'testbot',
  display_name: 'Test Bot',
  avatar_url: '',
  status_message: '',
  is_online: false,
  api_key: 'aims_testkey123',
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: '127.0.0.1',
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
  ...overrides,
});

describe('POST /api/v1/bots/register', () => {
  it('registers a new bot with valid input', async () => {
    let inserted = false;
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username') && !inserted) {
        return []; // not found
      }
      if (query.includes('COUNT')) return [{ count: 0 }];
      if (query.includes('INSERT INTO bots')) { inserted = true; return []; }
      if (query.includes('SELECT') && query.includes('bots') && inserted) {
        return [makeBotRow()];
      }
      return [];
    });

    const req = createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'testbot', displayName: 'Test Bot' },
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.api_key).toBeDefined();
    expect(data.bot.username).toBe('testbot');
  });

  it('rejects duplicate username with 409', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username')) {
        return [makeBotRow({ username: 'taken' })];
      }
      if (query.includes('COUNT')) return [{ count: 0 }];
      return [];
    });

    const req = createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'taken', displayName: 'Taken Bot' },
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toContain('already taken');
  });

  it('rejects invalid username with 400', async () => {
    const req = createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'AB', displayName: 'Bad' },
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('rejects missing username with 400', async () => {
    const req = createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { displayName: 'No Username' },
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('rejects reserved username', async () => {
    const req = createRequest('/api/v1/bots/register', {
      method: 'POST',
      body: { username: 'admin', displayName: 'Admin Bot' },
    });

    const { POST } = await import('@/app/api/v1/bots/register/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('reserved');
  });
});
