/**
 * Rate limiter for AIMS API routes.
 *
 * **Production mode** (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set):
 *   Uses Upstash Redis sliding-window rate limiting. Durable across cold starts
 *   and shared across all serverless instances.
 *
 * **Fallback mode** (env vars absent):
 *   In-memory sliding window. Resets on cold start — acceptable for dev/preview
 *   but NOT suitable for production under load.
 */

import { logger } from './logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Unique name for this limiter (e.g. 'api-read', 'register') */
  name: string;
  /** Max requests in the window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

// ---------------------------------------------------------------------------
// In-memory store (fallback)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memStores = new Map<string, Map<string, RateLimitEntry>>();

function getMemStore(name: string): Map<string, RateLimitEntry> {
  let store = memStores.get(name);
  if (!store) {
    store = new Map();
    memStores.set(name, store);
  }
  return store;
}

function checkMemoryRateLimit(config: RateLimitConfig, identifier: string): RateLimitResult {
  const store = getMemStore(config.name);
  const now = Date.now();

  let entry = store.get(identifier);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
    store.set(identifier, entry);
  }

  entry.count++;
  const remaining = Math.max(0, config.max - entry.count);
  const allowed = entry.count <= config.max;

  return { allowed, limit: config.max, remaining, resetAt: entry.resetAt };
}

// ---------------------------------------------------------------------------
// Redis / Upstash store
// ---------------------------------------------------------------------------

let _redisLimiters: Map<string, import('@upstash/ratelimit').Ratelimit> | null = null;
let _redisAvailable: boolean | null = null;

/**
 * Returns true when Upstash env vars are configured.
 * Exported for testing / diagnostics.
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Lazily create an Upstash Ratelimit instance per config name.
 * Returns null if Redis is not configured.
 */
function getRedisLimiter(config: RateLimitConfig): import('@upstash/ratelimit').Ratelimit | null {
  if (!isRedisConfigured()) return null;

  if (!_redisLimiters) _redisLimiters = new Map();

  let limiter = _redisLimiters.get(config.name);
  if (limiter) return limiter;

  // Dynamic import avoided — these are lightweight and tree-shakeable.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Ratelimit } = require('@upstash/ratelimit') as typeof import('@upstash/ratelimit');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis');

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.max, `${config.windowMs} ms`),
    prefix: `aims:rl:${config.name}`,
    analytics: false,
  });

  _redisLimiters.set(config.name, limiter);
  return limiter;
}

async function checkRedisRateLimit(config: RateLimitConfig, identifier: string): Promise<RateLimitResult | null> {
  const limiter = getRedisLimiter(config);
  if (!limiter) return null;

  try {
    const res = await limiter.limit(identifier);
    _redisAvailable = true;
    return {
      allowed: res.success,
      limit: res.limit,
      remaining: res.remaining,
      resetAt: res.reset,
    };
  } catch (err) {
    // Redis down → fall back to in-memory. Log once.
    if (_redisAvailable !== false) {
      logger.error('Redis rate-limit unavailable, falling back to in-memory', {
        error: err instanceof Error ? err.message : String(err),
      });
      _redisAvailable = false;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check rate limit for a given identifier (IP, username, etc.)
 *
 * Tries Redis first (if configured), falls back to in-memory.
 * The sync signature is preserved for backward compatibility — Redis calls
 * are awaited internally.  Since Next.js API routes are async anyway, the
 * overhead is negligible.
 */
export async function checkRateLimitAsync(config: RateLimitConfig, identifier: string): Promise<RateLimitResult> {
  const redisResult = await checkRedisRateLimit(config, identifier);
  if (redisResult) return redisResult;
  return checkMemoryRateLimit(config, identifier);
}

/**
 * Synchronous check — in-memory only.
 * Kept for backward compatibility with existing route handlers that call
 * `checkRateLimit` synchronously.  Routes should migrate to
 * `checkRateLimitAsync` for Redis-backed durability.
 */
export function checkRateLimit(config: RateLimitConfig, identifier: string): RateLimitResult {
  return checkMemoryRateLimit(config, identifier);
}

/**
 * Get X-RateLimit headers from a result
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}

/**
 * Return a 429 response with rate limit headers
 */
export function rateLimitResponse(result: RateLimitResult, endpoint: string, identifier: string): Response {
  logger.rateLimit(endpoint, identifier);
  const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  const minutes = Math.ceil(retryAfterSec / 60);
  const friendlyWait = minutes >= 2 ? `${minutes} minutes` : `${retryAfterSec} seconds`;
  return Response.json(
    {
      success: false,
      error: `Whoa, slow down! You've hit the rate limit. Please try again in ${friendlyWait}.`,
      retryAfter: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(result),
        'Retry-After': String(retryAfterSec),
      },
    }
  );
}

// Pre-configured limiters
export const LIMITS = {
  PUBLIC_READ: { name: 'public-read', max: 100, windowMs: 60_000 },
  AUTH_WRITE: { name: 'auth-write', max: 30, windowMs: 60_000 },
  REGISTER: { name: 'register', max: 5, windowMs: 3600_000 },
  SEARCH: { name: 'search', max: 30, windowMs: 60_000 },
  WEBHOOK_INGEST: { name: 'webhook-ingest', max: 60, windowMs: 60_000 },
} as const;

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

// ---------------------------------------------------------------------------
// Test helpers (exported for unit tests only)
// ---------------------------------------------------------------------------

/** Reset all in-memory stores. For testing only. */
export function _resetMemoryStores(): void {
  memStores.clear();
}

/** Reset Redis limiter cache. For testing only. */
export function _resetRedisLimiters(): void {
  _redisLimiters = null;
  _redisAvailable = null;
}
