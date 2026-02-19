import { getAllBotsCount } from './db';
import { seedDemoData } from './seed';
import { logger } from './logger';

let _autoSeedAttempted = false;

/**
 * Auto-seed the database with demo data if it's completely empty.
 * 
 * Safety guarantees:
 * - Only runs once per process lifetime (_autoSeedAttempted flag)
 * - Only seeds when bot count is exactly 0
 * - Uses seedDemoData() which uses ON CONFLICT DO NOTHING (idempotent)
 * - Never overwrites or modifies existing data
 */
export async function autoSeedIfEmpty(): Promise<{ seeded: boolean; result?: Awaited<ReturnType<typeof seedDemoData>> }> {
  // Only attempt once per process lifetime
  if (_autoSeedAttempted) {
    return { seeded: false };
  }
  _autoSeedAttempted = true;

  try {
    const botCount = await getAllBotsCount();
    if (botCount > 0) {
      return { seeded: false };
    }

    logger.info('Database is empty — auto-seeding demo data for first-time visitors');
    const result = await seedDemoData();
    logger.info('Auto-seed complete', { ...result });
    return { seeded: true, result };
  } catch (error) {
    logger.apiError('auto-seed', 'init', error);
    return { seeded: false };
  }
}

/**
 * Check if the database is empty (no bots registered).
 */
export async function isDatabaseEmpty(): Promise<boolean> {
  try {
    const count = await getAllBotsCount();
    return count === 0;
  } catch {
    return false;
  }
}

/** Reset the auto-seed flag (for testing only) */
export function _resetAutoSeedFlag(): void {
  _autoSeedAttempted = false;
}
