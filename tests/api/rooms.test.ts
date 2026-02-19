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

describe('POST /api/v1/rooms', () => {
  it('creates a room with valid participants', async () => {
    const room = { id: 'room-1', room_id: 'room-xyz', title: 'Test Room', participants: ['alice', 'bob'], created_at: new Date(), last_activity: new Date() };
    let botLookups = 0;
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot('alice')];
      if (query.includes('SELECT') && query.includes('bots') && query.includes('username')) {
        botLookups++;
        return [mockBot(botLookups === 1 ? 'alice' : 'bob')];
      }
      if (query.includes('INSERT INTO rooms')) return [];
      if (query.includes('rooms') && query.includes('WHERE id')) return [room];
      return [];
    });

    const req = createAuthRequest('/api/v1/rooms', 'aims_alicekey', {
      method: 'POST',
      body: { title: 'Test Room', participants: ['alice', 'bob'] },
    });

    const { POST } = await import('@/app/api/v1/rooms/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.room.title).toBe('Test Room');
  });

  it('rejects room without auth', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest('/api/v1/rooms', {
      method: 'POST',
      body: { title: 'Test', participants: ['a', 'b'] },
    });

    const { POST } = await import('@/app/api/v1/rooms/route');
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('rejects room with less than 2 participants', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot('alice')];
      return [];
    });

    const req = createAuthRequest('/api/v1/rooms', 'aims_alicekey', {
      method: 'POST',
      body: { title: 'Solo', participants: ['alice'] },
    });

    const { POST } = await import('@/app/api/v1/rooms/route');
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('rejects room where auth bot is not participant', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot('charlie')];
      return [];
    });

    const req = createAuthRequest('/api/v1/rooms', 'aims_charliekey', {
      method: 'POST',
      body: { title: 'Not My Room', participants: ['alice', 'bob'] },
    });

    const { POST } = await import('@/app/api/v1/rooms/route');
    const response = await POST(req);
    expect(response.status).toBe(403);
  });
});

describe('GET /api/v1/rooms', () => {
  it('lists all rooms', async () => {
    const rooms = [
      { id: 'r-1', room_id: 'room-1', title: 'Room 1', participants: ['a', 'b'], created_at: new Date(), last_activity: new Date() },
    ];
    setAllQueriesHandler(() => rooms);

    const req = createRequest('/api/v1/rooms');
    const { GET } = await import('@/app/api/v1/rooms/route');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.rooms).toHaveLength(1);
  });
});
