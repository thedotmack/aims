import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track SQL calls
const sqlCalls: Array<{ query: string; params: unknown[] }> = [];

vi.mock('@neondatabase/serverless', () => ({
  neon: () => {
    const fn = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join('$?');
      sqlCalls.push({ query, params: values });

      if (query.includes('SELECT') && query.includes('digest_runs') && query.includes('frequency')) {
        // getRecentDigestRun — return empty by default
        return Promise.resolve([]);
      }
      if (query.includes('INSERT INTO digest_runs')) {
        return Promise.resolve([{ id: 'run-abc' }]);
      }
      if (query.includes('UPDATE digest_runs') && query.includes('completed')) {
        return Promise.resolve([]);
      }
      if (query.includes('UPDATE digest_runs') && query.includes('failed')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    };
    return fn;
  },
}));

import { getRecentDigestRun, createDigestRun, completeDigestRun, failDigestRun } from '@/lib/db';

describe('Digest run tracking', () => {
  beforeEach(() => {
    sqlCalls.length = 0;
  });

  it('getRecentDigestRun queries with correct window for daily (20h)', async () => {
    await getRecentDigestRun('daily');
    const call = sqlCalls.find(c => c.query.includes('digest_runs'));
    expect(call).toBeDefined();
    expect(call!.params).toContain('daily');
    expect(call!.params).toContain(20); // 20 hours window
  });

  it('getRecentDigestRun queries with correct window for weekly (144h)', async () => {
    await getRecentDigestRun('weekly');
    const call = sqlCalls.find(c => c.query.includes('digest_runs'));
    expect(call!.params).toContain('weekly');
    expect(call!.params).toContain(144); // 6 days
  });

  it('createDigestRun inserts with frequency and trigger source', async () => {
    const id = await createDigestRun('daily', 'cron');
    expect(id).toBe('run-abc');
    const call = sqlCalls.find(c => c.query.includes('INSERT INTO digest_runs'));
    expect(call!.params).toContain('daily');
    expect(call!.params).toContain('cron');
  });

  it('completeDigestRun updates sent/failed counts', async () => {
    await completeDigestRun('run-abc', 5, 1);
    const call = sqlCalls.find(c => c.query.includes('UPDATE digest_runs') && c.query.includes('completed'));
    expect(call).toBeDefined();
    expect(call!.params).toContain(5);
    expect(call!.params).toContain(1);
  });

  it('failDigestRun marks status as failed', async () => {
    await failDigestRun('run-abc');
    const call = sqlCalls.find(c => c.query.includes('UPDATE digest_runs') && c.query.includes('failed'));
    expect(call).toBeDefined();
    expect(call!.params).toContain('run-abc');
  });
});
