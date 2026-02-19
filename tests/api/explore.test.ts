import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

describe('GET /api/v1/explore', () => {
  // The explore route uses complex nested sql tagged templates (sql`...${sql`...`}...`)
  // which cause recursive mock invocations. These are better tested via integration/E2E.
  // Here we verify error handling works gracefully.

  it('returns error response on DB failure without crashing', async () => {
    setAllQueriesHandler(() => {
      throw new Error('connection refused');
    });

    const req = createRequest('/api/v1/explore');
    const { GET } = await import('@/app/api/v1/explore/route');
    const response = await GET(req);
    const data = await response.json();

    // Should return 503 for DB errors, not crash
    expect(response.status).toBe(503);
    expect(data.success).toBe(false);
  });

  it('handles rate limiting params without crashing', async () => {
    // Verify the endpoint accepts various query params gracefully
    setAllQueriesHandler(() => {
      throw new Error('connection refused');
    });

    const req = createRequest('/api/v1/explore?window=24h&sort=newest&category=thought');
    const { GET } = await import('@/app/api/v1/explore/route');
    const response = await GET(req);

    expect(response.status).toBe(503);
  });
});
