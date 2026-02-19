import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';

beforeEach(() => {
  clearMocks();
  vi.resetModules();
});

describe('initDB', () => {
  it('executes CREATE TABLE statements for all required tables', async () => {
    const executedQueries: string[] = [];
    setAllQueriesHandler((query) => {
      executedQueries.push(query);
      return [];
    });

    const { initDB } = await import('@/lib/db');
    await initDB();

    const tables = ['chats', 'messages', 'webhooks', 'bots', 'invites', 'dms', 'rooms', 'feed_items', 'subscribers', 'feed_reactions', 'digest_subscribers', 'api_logs', 'webhook_deliveries'];
    for (const table of tables) {
      expect(executedQueries.some(q => q.includes('CREATE TABLE') && q.includes(table))).toBe(true);
    }
  });

  it('creates required indexes', async () => {
    const executedQueries: string[] = [];
    setAllQueriesHandler((query) => {
      executedQueries.push(query);
      return [];
    });

    const { initDB } = await import('@/lib/db');
    await initDB();

    const requiredIndexes = ['idx_bots_username', 'idx_bots_api_key', 'idx_feed_bot', 'idx_feed_created', 'idx_feed_content_hash'];
    for (const idx of requiredIndexes) {
      expect(executedQueries.some(q => q.includes(idx))).toBe(true);
    }
  });

  it('adds token_balance column via ALTER TABLE', async () => {
    const executedQueries: string[] = [];
    setAllQueriesHandler((query) => {
      executedQueries.push(query);
      return [];
    });

    const { initDB } = await import('@/lib/db');
    await initDB();

    expect(executedQueries.some(q => q.includes('token_balance') && q.includes('ALTER TABLE'))).toBe(true);
  });

  it('adds chain_hash and chain_tx columns', async () => {
    const executedQueries: string[] = [];
    setAllQueriesHandler((query) => {
      executedQueries.push(query);
      return [];
    });

    const { initDB } = await import('@/lib/db');
    await initDB();

    expect(executedQueries.some(q => q.includes('chain_hash'))).toBe(true);
    expect(executedQueries.some(q => q.includes('chain_tx'))).toBe(true);
  });

  it('uses IF NOT EXISTS for safety', async () => {
    const executedQueries: string[] = [];
    setAllQueriesHandler((query) => {
      executedQueries.push(query);
      return [];
    });

    const { initDB } = await import('@/lib/db');
    await initDB();

    const createTableQueries = executedQueries.filter(q => q.includes('CREATE TABLE'));
    for (const q of createTableQueries) {
      expect(q).toContain('IF NOT EXISTS');
    }
  });
});
