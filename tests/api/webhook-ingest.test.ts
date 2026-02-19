import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createAuthRequest, createRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const mockBot = (balance = 100) => ({
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
  token_balance: balance,
});

const feedItem = {
  id: 'feed-123',
  bot_username: 'testbot',
  feed_type: 'observation',
  title: 'Test',
  content: 'Observed something',
  metadata: { source: 'claude-mem' },
  reply_to: null,
  pinned: false,
  created_at: new Date(),
  chain_hash: null,
  chain_tx: null,
  source_type: null,
  content_hash: null,
};

describe('POST /api/v1/webhooks/ingest (claude-mem)', () => {
  it('ingests a claude-mem observation', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot()];
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) return [feedItem];
      if (query.includes('UPDATE bots SET last_seen')) return [];
      if (query.includes('INSERT INTO webhook_deliveries')) return [];
      if (query.includes('subscribers')) return [];
      return [];
    });

    const req = createAuthRequest('/api/v1/webhooks/ingest', 'aims_testkey123', {
      method: 'POST',
      body: {
        type: 'observation',
        content: 'Observed something interesting in the codebase',
        title: 'Code Review',
        facts: ['lib/db.ts has 96 functions'],
        files_read: ['lib/db.ts'],
        project: 'aims',
      },
    });

    const { POST } = await import('@/app/api/v1/webhooks/ingest/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.item).toBeDefined();
  });

  it('accepts text field as content fallback', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot()];
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) return [feedItem];
      if (query.includes('UPDATE bots SET last_seen')) return [];
      if (query.includes('INSERT INTO webhook_deliveries')) return [];
      if (query.includes('subscribers')) return [];
      return [];
    });

    const req = createAuthRequest('/api/v1/webhooks/ingest', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'thought', text: 'Thinking about architecture' },
    });

    const { POST } = await import('@/app/api/v1/webhooks/ingest/route');
    const response = await POST(req);

    expect(response.status).toBe(200);
  });

  it('accepts narrative field as content fallback', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot()];
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) return [feedItem];
      if (query.includes('UPDATE bots SET last_seen')) return [];
      if (query.includes('INSERT INTO webhook_deliveries')) return [];
      if (query.includes('subscribers')) return [];
      return [];
    });

    const req = createAuthRequest('/api/v1/webhooks/ingest', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'summary', narrative: 'Session summary narrative' },
    });

    const { POST } = await import('@/app/api/v1/webhooks/ingest/route');
    const response = await POST(req);

    expect(response.status).toBe(200);
  });

  it('rejects without auth', async () => {
    setAllQueriesHandler(() => []);

    const req = createRequest('/api/v1/webhooks/ingest', {
      method: 'POST',
      body: { type: 'observation', content: 'test' },
    });

    const { POST } = await import('@/app/api/v1/webhooks/ingest/route');
    const response = await POST(req);

    expect(response.status).toBe(401);
  });

  it('rejects with no content fields', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot()];
      if (query.includes('INSERT INTO webhook_deliveries')) return [];
      return [];
    });

    const req = createAuthRequest('/api/v1/webhooks/ingest', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'observation' },
    });

    const { POST } = await import('@/app/api/v1/webhooks/ingest/route');
    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('maps session_summary type to summary', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot()];
      if (query.includes('UPDATE bots SET token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) return [];
      if (query.includes('feed_items') && query.includes('WHERE id')) return [{ ...feedItem, feed_type: 'summary' }];
      if (query.includes('UPDATE bots SET last_seen')) return [];
      if (query.includes('INSERT INTO webhook_deliveries')) return [];
      if (query.includes('subscribers')) return [];
      return [];
    });

    const req = createAuthRequest('/api/v1/webhooks/ingest', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'session_summary', content: 'Session done' },
    });

    const { POST } = await import('@/app/api/v1/webhooks/ingest/route');
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.item.feedType).toBe('summary');
  });

  it('returns 402 when bot has insufficient tokens', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('bots') && query.includes('api_key')) return [mockBot(0)];
      if (query.includes('UPDATE bots SET token_balance')) return []; // insufficient
      if (query.includes('SELECT') && query.includes('token_balance')) return [{ token_balance: 0 }];
      if (query.includes('INSERT INTO webhook_deliveries')) return [];
      return [];
    });

    const req = createAuthRequest('/api/v1/webhooks/ingest', 'aims_testkey123', {
      method: 'POST',
      body: { type: 'observation', content: 'No tokens left' },
    });

    const { POST } = await import('@/app/api/v1/webhooks/ingest/route');
    const response = await POST(req);

    expect(response.status).toBe(402);
  });
});
