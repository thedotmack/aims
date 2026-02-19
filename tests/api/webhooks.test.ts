import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createAdminRequest, createRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

describe('GET /api/v1/webhooks', () => {
  it('returns webhooks for admin', async () => {
    setAllQueriesHandler(() => [
      { id: 'wh-1', url: 'https://example.com/hook', chat_key: null, events: ['message.created'], secret: null, created_at: new Date() },
    ]);

    const req = createAdminRequest('/api/v1/webhooks');
    const { GET } = await import('@/app/api/v1/webhooks/route');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.webhooks).toHaveLength(1);
  });

  it('rejects non-admin', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest('/api/v1/webhooks');
    const { GET } = await import('@/app/api/v1/webhooks/route');
    const response = await GET(req);

    expect(response.status).toBe(403);
  });
});

describe('POST /api/v1/webhooks', () => {
  it('creates a webhook', async () => {
    const wh = { id: 'wh-1', url: 'https://example.com/hook', chat_key: null, events: ['message.created'], secret: null, created_at: new Date() };
    setAllQueriesHandler((query) => {
      if (query.includes('INSERT INTO webhooks')) return [];
      if (query.includes('webhooks') && query.includes('WHERE id')) return [wh];
      return [];
    });

    const req = createAdminRequest('/api/v1/webhooks', {
      method: 'POST',
      body: { url: 'https://example.com/hook' },
    });

    const { POST } = await import('@/app/api/v1/webhooks/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.webhook.url).toBe('https://example.com/hook');
  });

  it('rejects invalid URL', async () => {
    const req = createAdminRequest('/api/v1/webhooks', {
      method: 'POST',
      body: { url: 'not-a-url' },
    });

    const { POST } = await import('@/app/api/v1/webhooks/route');
    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('rejects missing url', async () => {
    const req = createAdminRequest('/api/v1/webhooks', {
      method: 'POST',
      body: {},
    });

    const { POST } = await import('@/app/api/v1/webhooks/route');
    const response = await POST(req);

    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/v1/webhooks/:id', () => {
  it('deletes a webhook', async () => {
    setAllQueriesHandler(() => [{ id: 'wh-1' }]); // RETURNING id

    const req = createAdminRequest('/api/v1/webhooks/wh-1', { method: 'DELETE' });
    const { DELETE } = await import('@/app/api/v1/webhooks/[id]/route');
    const response = await DELETE(req, { params: Promise.resolve({ id: 'wh-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 404 for nonexistent webhook', async () => {
    setAllQueriesHandler(() => []); // empty RETURNING

    const req = createAdminRequest('/api/v1/webhooks/wh-nope', { method: 'DELETE' });
    const { DELETE } = await import('@/app/api/v1/webhooks/[id]/route');
    const response = await DELETE(req, { params: Promise.resolve({ id: 'wh-nope' }) });

    expect(response.status).toBe(404);
  });

  it('rejects non-admin', async () => {
    const req = createRequest('/api/v1/webhooks/wh-1', { method: 'DELETE' });
    const { DELETE } = await import('@/app/api/v1/webhooks/[id]/route');
    const response = await DELETE(req, { params: Promise.resolve({ id: 'wh-1' }) });

    expect(response.status).toBe(403);
  });
});
