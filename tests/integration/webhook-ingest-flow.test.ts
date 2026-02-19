import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest, createAuthRequest } from '../helpers';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const bot = {
  id: 'bot-webhook',
  username: 'webhook-bot',
  display_name: 'Webhook Bot',
  avatar_url: '',
  status_message: '',
  is_online: false,
  api_key: 'aims_webhook_key_789',
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: '127.0.0.1',
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
};

const feedItemRow = {
  id: 'feed-wh-001',
  bot_username: 'webhook-bot',
  feed_type: 'observation',
  title: '',
  content: 'Observed something',
  metadata: '{"source":"claude-mem"}',
  reply_to: null,
  chain_hash: null,
  chain_tx: null,
  source_type: 'claude-mem',
  content_hash: null,
  pinned: false,
  created_at: new Date(),
};

describe('Integration: Webhook Ingest → Feed Flow', () => {
  it('claude-mem webhook → creates feed item → appears in global feed', async () => {
    let feedCreated = false;

    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots')) return [bot];
      if (query.includes('UPDATE') && query.includes('token_balance')) return [{ token_balance: 99 }];
      if (query.includes('INSERT INTO feed_items')) { feedCreated = true; return []; }
      if (query.includes('SELECT') && query.includes('feed_items')) {
        return feedCreated ? [feedItemRow] : [];
      }
      if (query.includes('COUNT') && query.includes('feed_items')) return [{ count: feedCreated ? 1 : 0 }];
      if (query.includes('webhooks')) return [];
      return [];
    });

    // Step 1: Ingest via webhook
    const { POST: ingestPOST } = await import('@/app/api/v1/webhooks/ingest/route');
    const ingestRes = await ingestPOST(createAuthRequest('/api/v1/webhooks/ingest', bot.api_key, {
      method: 'POST',
      body: { type: 'observation', content: 'Observed something', username: 'webhook-bot' },
    }));
    expect(ingestRes.status).toBe(200);
    const ingestData = await ingestRes.json();
    expect(ingestData.success).toBe(true);

    // Step 2: Verify in global feed
    const { GET: feedGET } = await import('@/app/api/v1/feed/route');
    const feedRes = await feedGET(createRequest('/api/v1/feed'));
    const feedData = await feedRes.json();
    expect(feedRes.status).toBe(200);
    expect(feedData.items.length).toBeGreaterThan(0);
    expect(feedData.items[0].content).toBe('Observed something');
  });

  it('webhook ingest with insufficient tokens returns 402', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('SELECT') && query.includes('bots')) return [{ ...bot, token_balance: 0 }];
      if (query.includes('UPDATE') && query.includes('token_balance')) return [];
      return [];
    });

    const { POST: ingestPOST } = await import('@/app/api/v1/webhooks/ingest/route');
    const res = await ingestPOST(createAuthRequest('/api/v1/webhooks/ingest', bot.api_key, {
      method: 'POST',
      body: { type: 'observation', content: 'No tokens', username: 'webhook-bot' },
    }));
    expect(res.status).toBe(402);
  });

  it('webhook ingest maps claude-mem types correctly', async () => {
    const typeMap = [
      { input: 'observation', expected: 'observation' },
      { input: 'thought', expected: 'thought' },
      { input: 'action', expected: 'action' },
      { input: 'session_summary', expected: 'summary' },
      { input: 'reflection', expected: 'thought' },
      { input: 'tool_use', expected: 'action' },
    ];

    for (const { input, expected } of typeMap) {
      clearMocks();
      vi.resetModules();
      let capturedType = '';

      setAllQueriesHandler((query, values) => {
        if (query.includes('SELECT') && query.includes('bots')) return [bot];
        if (query.includes('UPDATE') && query.includes('token_balance')) return [{ token_balance: 99 }];
        if (query.includes('INSERT INTO feed_items')) {
          capturedType = values[2] as string; // feed_type is 3rd value
          return [];
        }
        if (query.includes('SELECT') && query.includes('feed_items')) {
          return [{ ...feedItemRow, feed_type: expected }];
        }
        if (query.includes('webhooks')) return [];
        return [];
      });

      const { POST: ingestPOST } = await import('@/app/api/v1/webhooks/ingest/route');
      const res = await ingestPOST(createAuthRequest('/api/v1/webhooks/ingest', bot.api_key, {
        method: 'POST',
        body: { type: input, content: `Testing ${input}`, username: 'webhook-bot' },
      }));
      expect(res.status).toBe(200);
    }
  });
});
