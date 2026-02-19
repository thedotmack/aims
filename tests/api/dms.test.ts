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

describe('POST /api/v1/dms', () => {
  it('creates a DM between two bots', async () => {
    const dm = { id: 'dm-1', bot1_username: 'alice', bot2_username: 'bob', created_at: new Date(), last_activity: new Date() };
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot('alice')];
      if (query.includes('dms') && query.includes('bot1_username') && query.includes('SELECT')) return []; // no existing
      if (query.includes('bots') && query.includes('username')) {
        // getBotByUsername calls
        return [mockBot('alice')];
      }
      if (query.includes('INSERT INTO dms')) return [];
      if (query.includes('dms') && query.includes('WHERE id')) return [dm];
      return [];
    });

    // Need to handle both getBotByUsername calls
    let botLookupCount = 0;
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot('alice')];
      if (query.includes('dms') && query.includes('bot1_username') && query.includes('bot2_username')) return []; // no existing DM
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username')) {
        botLookupCount++;
        if (botLookupCount <= 1) return [mockBot('alice')];
        return [mockBot('bob')];
      }
      if (query.includes('INSERT INTO dms')) return [];
      if (query.includes('dms') && query.includes('WHERE id')) return [dm];
      return [];
    });

    const req = createAuthRequest('/api/v1/dms', 'aims_alicekey', {
      method: 'POST',
      body: { from: 'alice', to: 'bob' },
    });

    const { POST } = await import('@/app/api/v1/dms/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.dm).toBeDefined();
    expect(data.dm.participants).toContain('alice');
  });

  it('rejects DM without auth', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest('/api/v1/dms', {
      method: 'POST',
      body: { from: 'alice', to: 'bob' },
    });

    const { POST } = await import('@/app/api/v1/dms/route');
    const response = await POST(req);

    expect(response.status).toBe(401);
  });

  it('rejects DM to self', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot('alice')];
      return [];
    });

    const req = createAuthRequest('/api/v1/dms', 'aims_alicekey', {
      method: 'POST',
      body: { from: 'alice', to: 'alice' },
    });

    const { POST } = await import('@/app/api/v1/dms/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('yourself');
  });

  it('rejects DM with missing fields', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot('alice')];
      return [];
    });

    const req = createAuthRequest('/api/v1/dms', 'aims_alicekey', {
      method: 'POST',
      body: { from: 'alice' },
    });

    const { POST } = await import('@/app/api/v1/dms/route');
    const response = await POST(req);

    expect(response.status).toBe(400);
  });
});

describe('GET /api/v1/dms', () => {
  it('lists DMs for a bot', async () => {
    const dms = [
      { id: 'dm-1', bot1_username: 'alice', bot2_username: 'bob', created_at: new Date(), last_activity: new Date() },
    ];
    setAllQueriesHandler((query) => {
      if (query.includes('dms') && query.includes('bot1_username')) return dms;
      return [];
    });

    const req = createRequest('/api/v1/dms?bot=alice');
    const { GET } = await import('@/app/api/v1/dms/route');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.dms).toHaveLength(1);
  });

  it('requires bot query param', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest('/api/v1/dms');
    const { GET } = await import('@/app/api/v1/dms/route');
    const response = await GET(req);

    expect(response.status).toBe(400);
  });
});
