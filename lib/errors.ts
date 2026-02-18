/**
 * Error handling helpers for graceful degradation.
 */

import { logger } from './logger';

/**
 * Check if an error is a database/connection error
 */
export function isDbError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('connect') ||
      msg.includes('econnrefused') ||
      msg.includes('timeout') ||
      msg.includes('too many clients') ||
      msg.includes('connection terminated') ||
      msg.includes('database') ||
      msg.includes('neon') ||
      msg.includes('pg_') ||
      msg.includes('relation') ||
      msg.includes('ssl')
    );
  }
  return false;
}

/**
 * Handle an API error, returning 503 for DB errors, 500 otherwise
 */
export function handleApiError(
  error: unknown,
  endpoint: string,
  method: string,
  extraHeaders?: Record<string, string>
): Response {
  logger.apiError(endpoint, method, error);

  if (isDbError(error)) {
    return Response.json(
      { success: false, error: 'Service temporarily unavailable. Please try again shortly.' },
      { status: 503, headers: { 'Retry-After': '30', ...extraHeaders } }
    );
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return Response.json(
    { success: false, error: message },
    { status: 500, headers: extraHeaders }
  );
}
