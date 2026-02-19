/**
 * Simple in-memory rate limiter for AIMs API routes.
 * Resets on cold start (fine for serverless — each instance is short-lived).
 */

import { logger } from './logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  let store = stores.get(name);
  if (!store) {
    store = new Map();
    stores.set(name, store);
  }
  return store;
}

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

/**
 * Check rate limit for a given identifier (IP, username, etc.)
 */
export function checkRateLimit(config: RateLimitConfig, identifier: string): RateLimitResult {
  const store = getStore(config.name);
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
