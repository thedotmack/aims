import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createAuthRequest, createRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const mockBot = (username: string) => ({
  id: `bot-${username}`,
  username,
  display_name: username,
  avatar_url: '',
  status_message: '',
  is_online: true,
  api_key: `aims_${username}key`,
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: null,
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
});

describe('POST /api/v1/bots/:username/subscribe', () => {
  it('follows a bot', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot('alice')];
      if (query.includes('bots') && query.includes('username')) return [mockBot('bob')];
      if (query.includes('INSERT INTO subscribers')) return [];
      if (query.includes('COUNT') && query.includes('subscribers')) return [{ count: 1 }];
      return [];
    });

    const req = createAuthRequest('/api/v1/bots/bob/subscribe', 'aims_alicekey', { method: 'POST' });
    const { POST } = await import('@/app/api/v1/bots/[username]/subscribe/route');
    const response = await POST(req, { params: Promise.resolve({ username: 'bob' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('bob');
  });

  it('rejects follow without auth', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest('/api/v1/bots/bob/subscribe', { method: 'POST' });
    const { POST } = await import('@/app/api/v1/bots/[username]/subscribe/route');
    const response = await POST(req, { params: Promise.resolve({ username: 'bob' }) });

    expect(response.status).toBe(401);
  });

  it('rejects self-follow', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot('alice')];
      if (query.includes('bots') && query.includes('username')) return [mockBot('alice')];
      return [];
    });

    const req = createAuthRequest('/api/v1/bots/alice/subscribe', 'aims_alicekey', { method: 'POST' });
    const { POST } = await import('@/app/api/v1/bots/[username]/subscribe/route');
    const response = await POST(req, { params: Promise.resolve({ username: 'alice' }) });

    expect(response.status).toBe(400);
  });

  it('returns 404 for nonexistent bot', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot('alice')];
      if (query.includes('bots') && query.includes('username')) return []; // not found
      return [];
    });

    const req = createAuthRequest('/api/v1/bots/nobody/subscribe', 'aims_alicekey', { method: 'POST' });
    const { POST } = await import('@/app/api/v1/bots/[username]/subscribe/route');
    const response = await POST(req, { params: Promise.resolve({ username: 'nobody' }) });

    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/v1/bots/:username/subscribe', () => {
  it('unfollows a bot', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot('alice')];
      if (query.includes('DELETE FROM subscribers')) return [];
      if (query.includes('COUNT') && query.includes('subscribers')) return [{ count: 0 }];
      return [];
    });

    const req = createAuthRequest('/api/v1/bots/bob/subscribe', 'aims_alicekey', { method: 'DELETE' });
    const { DELETE } = await import('@/app/api/v1/bots/[username]/subscribe/route');
    const response = await DELETE(req, { params: Promise.resolve({ username: 'bob' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

describe('GET /api/v1/bots/:username/subscribe', () => {
  it('returns follower counts', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [];
      if (query.includes('bots') && query.includes('username')) return [mockBot('bob')];
      if (query.includes('COUNT') && query.includes('target_username')) return [{ count: 5 }];
      if (query.includes('COUNT') && query.includes('subscriber_username')) return [{ count: 3 }];
      return [];
    });

    const req = createRequest('/api/v1/bots/bob/subscribe');
    const { GET } = await import('@/app/api/v1/bots/[username]/subscribe/route');
    const response = await GET(req, { params: Promise.resolve({ username: 'bob' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(typeof data.followers).toBe('number');
  });
});
