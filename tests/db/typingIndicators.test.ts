import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn().mockResolvedValue([]);
// Also make it work as tagged template
const sqlProxy = Object.assign(
  (...args: unknown[]) => mockSql(...args),
  { catch: () => Promise.resolve() }
);

vi.mock('@neondatabase/serverless', () => ({
  neon: () => sqlProxy,
}));

describe('Typing indicator DB functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('setTypingIndicator uses UPSERT', async () => {
    const { setTypingIndicator } = await import('@/lib/db');
    await setTypingIndicator('dm-1', 'bot-a');
    expect(mockSql).toHaveBeenCalled();
    // Verify the call includes our dm_id and username
    const callArgs = mockSql.mock.calls[0];
    // Tagged template: first arg is string array, rest are interpolated values
    const templateStrings = callArgs[0] as string[];
    const joined = templateStrings.join('?');
    expect(joined).toContain('INSERT INTO typing_indicators');
    expect(joined).toContain('ON CONFLICT');
  });

  it('clearTypingIndicator uses DELETE', async () => {
    const { clearTypingIndicator } = await import('@/lib/db');
    await clearTypingIndicator('dm-1', 'bot-a');
    expect(mockSql).toHaveBeenCalled();
    const templateStrings = mockSql.mock.calls[0][0] as string[];
    const joined = templateStrings.join('?');
    expect(joined).toContain('DELETE FROM typing_indicators');
  });

  it('getTypingIndicators filters by TTL', async () => {
    mockSql.mockResolvedValueOnce([{ username: 'bot-a' }]);
    const { getTypingIndicators } = await import('@/lib/db');
    const result = await getTypingIndicators('dm-1');
    expect(result).toEqual(['bot-a']);
    const templateStrings = mockSql.mock.calls[0][0] as string[];
    const joined = templateStrings.join('?');
    expect(joined).toContain('SELECT username FROM typing_indicators');
    expect(joined).toContain('MAKE_INTERVAL');
  });

  it('getTypingIndicators returns empty array when no one typing', async () => {
    mockSql.mockResolvedValueOnce([]);
    const { getTypingIndicators } = await import('@/lib/db');
    const result = await getTypingIndicators('dm-1');
    expect(result).toEqual([]);
  });

  it('TYPING_TTL is 10 seconds', async () => {
    mockSql.mockResolvedValueOnce([]);
    const { getTypingIndicators } = await import('@/lib/db');
    await getTypingIndicators('dm-1');
    // Check the interpolated value is 10
    const callArgs = mockSql.mock.calls[0];
    const values = callArgs.slice(1);
    // Values should include dm_id and TTL seconds
    expect(values).toContain(10);
  });
});
