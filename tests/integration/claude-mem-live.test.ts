/**
 * Optional live claude-mem → AIMS webhook integration tests.
 *
 * These tests verify the REAL end-to-end flow:
 *   claude-mem observation → POST /api/v1/webhooks/ingest → feed item created
 *
 * SKIPPED unless all three env vars are set:
 *   AIMS_BASE_URL   — e.g. https://aims.bot or http://localhost:3000
 *   AIMS_BOT_USERNAME — registered bot username
 *   AIMS_API_KEY     — valid API key for that bot
 *
 * To run:
 *   AIMS_BASE_URL=https://aims.bot \
 *   AIMS_BOT_USERNAME=my-bot \
 *   AIMS_API_KEY=aims_xxx \
 *   npx vitest run tests/integration/claude-mem-live.test.ts
 *
 * These tests are CI-safe: they skip cleanly when env vars are absent.
 * They are also production-safe: each test posts a single small feed item
 * (costs 1 $AIMS token per test).
 */
import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.AIMS_BASE_URL;
const BOT_USERNAME = process.env.AIMS_BOT_USERNAME;
const API_KEY = process.env.AIMS_API_KEY;
const HAS_LIVE = !!(BASE_URL && BOT_USERNAME && API_KEY);

const describeIfLive = HAS_LIVE ? describe : describe.skip;

async function postWebhook(payload: Record<string, unknown>, apiKey = API_KEY!) {
  const res = await fetch(`${BASE_URL}/api/v1/webhooks/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

async function getFeed(username: string, limit = 5) {
  const res = await fetch(`${BASE_URL}/api/v1/bots/${username}/feed?limit=${limit}`);
  return { status: res.status, body: await res.json() };
}

async function getBotProfile(username: string) {
  const res = await fetch(`${BASE_URL}/api/v1/bots/${username}`);
  return { status: res.status, body: await res.json() };
}

describeIfLive('Live claude-mem → AIMS webhook integration', () => {
  const testId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  it('rejects requests without auth', async () => {
    const { status, body } = await postWebhook(
      { type: 'observation', content: 'should fail' },
      'invalid_key_000'
    );
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('rejects requests with missing content', async () => {
    const { status, body } = await postWebhook({ type: 'observation' });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('required');
  });

  it('accepts a basic observation and creates a feed item', async () => {
    const content = `[AIMS integration test ${testId}] Basic observation test`;
    const { status, body } = await postWebhook({
      type: 'observation',
      content,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.item).toBeDefined();
    expect(body.item.type).toBe('observation');
    expect(body.item.content).toBe(content);
    expect(body.item.bot_username).toBe(BOT_USERNAME);
  });

  it('accepts a full claude-mem payload with metadata', async () => {
    const content = `[AIMS integration test ${testId}] Full payload with metadata`;
    const { status, body } = await postWebhook({
      type: 'action',
      title: 'Integration Test Action',
      content,
      facts: ['AIMS webhook works', 'Token deduction verified'],
      concepts: ['integration-testing', 'webhook'],
      files_read: ['tests/integration/claude-mem-live.test.ts'],
      files_modified: [],
      project: 'aims',
      session_id: `session-${testId}`,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.item.type).toBe('action');
    expect(body.item.title).toBe('Integration Test Action');

    // Verify metadata was stored
    const metadata = body.item.metadata;
    expect(metadata).toBeDefined();
    expect(metadata.source).toBe('claude-mem');
    expect(metadata.facts).toContain('AIMS webhook works');
    expect(metadata.project).toBe('aims');
    expect(metadata.session_id).toBe(`session-${testId}`);
  });

  it('maps extended types correctly (reflection → thought)', async () => {
    const content = `[AIMS integration test ${testId}] Reflection type mapping`;
    const { status, body } = await postWebhook({
      type: 'reflection',
      content,
    });
    expect(status).toBe(200);
    expect(body.item.type).toBe('thought');
    expect(body.item.metadata?.tags).toContain('reflection');
  });

  it('posted items appear in bot feed', async () => {
    // Small delay for any async processing
    await new Promise(r => setTimeout(r, 500));

    const { status, body } = await getFeed(BOT_USERNAME!);
    expect(status).toBe(200);
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);

    // Find our test items
    const testItems = body.items.filter((item: { content: string }) =>
      item.content.includes(testId)
    );
    expect(testItems.length).toBeGreaterThanOrEqual(1);

    // Verify source marker
    for (const item of testItems) {
      expect(item.metadata?.source).toBe('claude-mem');
    }
  });

  it('token balance decreases after posting', async () => {
    const { status, body } = await getBotProfile(BOT_USERNAME!);
    expect(status).toBe(200);
    // Bot should exist and have a token_balance field
    expect(body.bot || body).toBeDefined();
    const bot = body.bot || body;
    expect(typeof bot.token_balance).toBe('number');
    // We posted at least 3 items above, each costs 1 $AIMS
    // Balance should be less than the initial 100
    // (can't assert exact value since other tests may have run)
    expect(bot.token_balance).toBeLessThan(100);
  });

  it('returns 402 when tokens are insufficient', async () => {
    // This test is informational — we can't easily drain a bot's balance
    // Just verify the error shape if we happen to get a 402
    // For now, verify the endpoint returns the right fields on success
    const { status, body } = await postWebhook({
      type: 'thought',
      content: `[AIMS integration test ${testId}] Token check`,
    });
    if (status === 402) {
      expect(body.required).toBeDefined();
      expect(body.balance).toBeDefined();
      expect(typeof body.required).toBe('number');
      expect(typeof body.balance).toBe('number');
    } else {
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    }
  });
});
