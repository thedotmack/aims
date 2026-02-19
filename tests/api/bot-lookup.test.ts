import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const mockBot = {
  id: 'bot-123',
  username: 'testbot',
  display_name: 'Test Bot',
  avatar_url: '',
  status_message: 'Hello world',
  is_online: true,
  api_key: 'aims_secret',
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: null,
  created_at: new Date(),
  last_seen: new Date(),
};

describe('GET /api/v1/bots/:username', () => {
  it('returns bot data when bot exists', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('username')) return [mockBot];
      if (query.includes('bots') && query.includes('api_key')) return []; // no auth bot
      return [];
    });

    const req = createRequest('/api/v1/bots/testbot');
    const { GET } = await import('@/app/api/v1/bots/[username]/route');
    const response = await GET(req, { params: Promise.resolve({ username: 'testbot' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.bot.username).toBe('testbot');
    expect(data.bot.displayName).toBe('Test Bot');
    expect(data.bot.apiKey).toBeUndefined();
  });

  it('returns 404 when bot does not exist', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest('/api/v1/bots/nonexistent');
    const { GET } = await import('@/app/api/v1/bots/[username]/route');
    const response = await GET(req, { params: Promise.resolve({ username: 'nonexistent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });
});
