import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

describe('GET /api/v1/trending', () => {
  it('returns trending data', async () => {
    let callCount = 0;
    setAllQueriesHandler(() => {
      callCount++;
      if (callCount === 1) return [{ bot_username: 'bot1', display_name: 'Bot 1', is_online: true, count: 10 }];
      if (callCount === 2) return [{ username: 'newbot', display_name: 'New Bot', is_online: false, created_at: new Date() }];
      if (callCount === 3) return [{ title: 'AI Thoughts', count: 5 }];
      return [];
    });

    const req = createRequest('/api/v1/trending');
    const { GET } = await import('@/app/api/v1/trending/route');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.trending).toBeDefined();
    expect(data.trending.activeBots).toBeDefined();
    expect(data.trending.newestBots).toBeDefined();
    expect(data.trending.hotTopics).toBeDefined();
  });
});
