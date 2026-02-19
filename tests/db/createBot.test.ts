import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

const makeBotRow = (overrides = {}) => ({
  id: 'bot-123',
  username: 'newbot',
  display_name: 'New Bot',
  avatar_url: '',
  status_message: '',
  is_online: false,
  api_key: 'aims_abc123',
  webhook_url: null,
  key_created_at: new Date(),
  ip_address: '127.0.0.1',
  created_at: new Date(),
  last_seen: new Date(),
  token_balance: 100,
  ...overrides,
});

describe('createBot', () => {
  it('returns a bot with token_balance=100 (DB default)', async () => {
    setAllQueriesHandler((query) => {
      if (query.includes('INSERT INTO bots')) return [];
      if (query.includes('SELECT') && query.includes('bots')) return [makeBotRow()];
      return [];
    });

    const { createBot } = await import('@/lib/db');
    const bot = await createBot('newbot', 'New Bot', 'aims_abc123', '127.0.0.1');

    expect(bot.username).toBe('newbot');
    expect(bot.displayName).toBe('New Bot');
    expect(bot.tokenBalance).toBe(100);
  });

  it('generates a unique ID with bot- prefix', async () => {
    let insertedId = '';
    setAllQueriesHandler((query, values) => {
      if (query.includes('INSERT INTO bots')) {
        insertedId = values[0] as string;
        return [];
      }
      if (query.includes('SELECT') && query.includes('bots')) return [makeBotRow({ id: insertedId })];
      return [];
    });

    const { createBot } = await import('@/lib/db');
    const bot = await createBot('newbot', 'New Bot', 'aims_abc123', null);

    expect(bot.id).toMatch(/^bot-/);
  });

  it('passes ipAddress to the INSERT', async () => {
    let capturedValues: unknown[] = [];
    setAllQueriesHandler((query, values) => {
      if (query.includes('INSERT INTO bots')) {
        capturedValues = values;
        return [];
      }
      if (query.includes('SELECT')) return [makeBotRow()];
      return [];
    });

    const { createBot } = await import('@/lib/db');
    await createBot('newbot', 'New Bot', 'aims_abc123', '10.0.0.1');

    expect(capturedValues).toContain('10.0.0.1');
  });

  it('handles null ipAddress', async () => {
    let capturedValues: unknown[] = [];
    setAllQueriesHandler((query, values) => {
      if (query.includes('INSERT INTO bots')) {
        capturedValues = values;
        return [];
      }
      if (query.includes('SELECT')) return [makeBotRow({ ip_address: null })];
      return [];
    });

    const { createBot } = await import('@/lib/db');
    const bot = await createBot('newbot', 'New Bot', 'aims_abc123', null);

    expect(capturedValues).toContain(null);
    expect(bot).toBeDefined();
  });
});

describe('generateApiKey', () => {
  it('starts with aims_ prefix', async () => {
    const { generateApiKey } = await import('@/lib/db');
    const key = generateApiKey();
    expect(key).toMatch(/^aims_/);
  });

  it('generates unique keys', async () => {
    const { generateApiKey } = await import('@/lib/db');
    const keys = new Set(Array.from({ length: 100 }, () => generateApiKey()));
    expect(keys.size).toBe(100);
  });
});

describe('generateId', () => {
  it('uses the provided prefix', async () => {
    const { generateId } = await import('@/lib/db');
    expect(generateId('bot')).toMatch(/^bot-/);
    expect(generateId('feed')).toMatch(/^feed-/);
    expect(generateId('msg')).toMatch(/^msg-/);
  });

  it('includes timestamp', async () => {
    const { generateId } = await import('@/lib/db');
    const id = generateId('test');
    const parts = id.split('-');
    const timestamp = parseInt(parts[1]);
    expect(timestamp).toBeGreaterThan(Date.now() - 1000);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
  });
});
