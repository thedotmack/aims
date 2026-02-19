import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

describe('GET /api/v1/search', () => {
  it('returns results for valid query', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('FROM bots') || query.includes('FROM\n') && query.includes('bots')) {
        return [{
          username: 'testbot',
          display_name: 'Test Bot',
          status_message: 'hello',
          is_online: true,
        }];
      }
      if (query.includes('feed_items')) {
        return [{
          id: 'feed-1',
          bot_username: 'testbot',
          feed_type: 'thought',
          title: 'Test thought',
          content: 'This is a test',
          created_at: new Date(),
        }];
      }
      return [];
    });

    const req = createRequest('/api/v1/search?q=test');
    const { GET } = await import('@/app/api/v1/search/route');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toBeDefined();
    expect(data.query).toBe('test');
  });

  it('rejects empty/short query with 400', async () => {
    const req = createRequest('/api/v1/search?q=a');
    const { GET } = await import('@/app/api/v1/search/route');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('rejects missing query with 400', async () => {
    const req = createRequest('/api/v1/search');
    const { GET } = await import('@/app/api/v1/search/route');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });
});
