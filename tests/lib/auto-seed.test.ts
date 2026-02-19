import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  getAllBotsCount: vi.fn(),
}));

vi.mock('@/lib/seed', () => ({
  seedDemoData: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    apiError: vi.fn(),
  },
}));

import { autoSeedIfEmpty, isDatabaseEmpty, _resetAutoSeedFlag } from '@/lib/auto-seed';
import { getAllBotsCount } from '@/lib/db';
import { seedDemoData } from '@/lib/seed';

const mockGetAllBotsCount = getAllBotsCount as ReturnType<typeof vi.fn>;
const mockSeedDemoData = seedDemoData as ReturnType<typeof vi.fn>;

describe('autoSeedIfEmpty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetAutoSeedFlag();
  });

  it('seeds when database is empty (0 bots)', async () => {
    mockGetAllBotsCount.mockResolvedValue(0);
    mockSeedDemoData.mockResolvedValue({ bots: 4, feedItems: 60, dms: 3, subscriptions: 12 });

    const result = await autoSeedIfEmpty();

    expect(result.seeded).toBe(true);
    expect(result.result).toEqual({ bots: 4, feedItems: 60, dms: 3, subscriptions: 12 });
    expect(mockSeedDemoData).toHaveBeenCalledOnce();
  });

  it('does NOT seed when bots exist', async () => {
    mockGetAllBotsCount.mockResolvedValue(3);

    const result = await autoSeedIfEmpty();

    expect(result.seeded).toBe(false);
    expect(mockSeedDemoData).not.toHaveBeenCalled();
  });

  it('only runs once per process lifetime', async () => {
    mockGetAllBotsCount.mockResolvedValue(0);
    mockSeedDemoData.mockResolvedValue({ bots: 4, feedItems: 60, dms: 3, subscriptions: 12 });

    const result1 = await autoSeedIfEmpty();
    expect(result1.seeded).toBe(true);

    // Reset mock to return 0 again — but flag should prevent re-run
    mockGetAllBotsCount.mockResolvedValue(0);
    const result2 = await autoSeedIfEmpty();
    expect(result2.seeded).toBe(false);
    expect(mockSeedDemoData).toHaveBeenCalledOnce(); // still just once
  });

  it('handles seedDemoData errors gracefully', async () => {
    mockGetAllBotsCount.mockResolvedValue(0);
    mockSeedDemoData.mockRejectedValue(new Error('DB connection failed'));

    const result = await autoSeedIfEmpty();

    expect(result.seeded).toBe(false);
  });

  it('handles getAllBotsCount errors gracefully', async () => {
    mockGetAllBotsCount.mockRejectedValue(new Error('DB unavailable'));

    const result = await autoSeedIfEmpty();

    expect(result.seeded).toBe(false);
  });
});

describe('isDatabaseEmpty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when 0 bots', async () => {
    mockGetAllBotsCount.mockResolvedValue(0);
    expect(await isDatabaseEmpty()).toBe(true);
  });

  it('returns false when bots exist', async () => {
    mockGetAllBotsCount.mockResolvedValue(5);
    expect(await isDatabaseEmpty()).toBe(false);
  });

  it('returns false on error', async () => {
    mockGetAllBotsCount.mockRejectedValue(new Error('fail'));
    expect(await isDatabaseEmpty()).toBe(false);
  });
});
