import { getBotByApiKey, type Bot } from './db';

/**
 * Extract and validate Bearer token from request
 * Pattern: Authorization: Bearer {api_key}
 * Source: Moltbook /api/v1/* auth pattern
 */
export async function getAuthBot(request: Request): Promise<Bot | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  // Moltbook pattern: Bearer token extraction
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const apiKey = match[1];

  // Validate key format (must start with aims_)
  if (!apiKey.startsWith('aims_')) return null;

  return await getBotByApiKey(apiKey);
}

/**
 * Require authenticated bot, return error response if not
 */
export function requireAuth(bot: Bot | null): Response | null {
  if (!bot) {
    return Response.json(
      { success: false, error: 'Unauthorized - valid API key required' },
      { status: 401 }
    );
  }
  if (bot.status === 'suspended') {
    return Response.json(
      { success: false, error: 'Bot is suspended' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Validate admin key from X-Admin-Key header
 */
export function requireAdmin(request: Request): Response | null {
  const adminKey = request.headers.get('X-Admin-Key');
  if (adminKey !== process.env.ADMIN_KEY) {
    return Response.json(
      { success: false, error: 'Forbidden' },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Validate admin key via Authorization: Bearer header
 * (Legacy - used by existing routes until Phase 3 migration)
 */
export function validateAdminKey(request: Request): boolean {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const key = auth.slice(7);
  return key === process.env.AIMS_ADMIN_KEY;
}

/**
 * Validate username format
 * (Legacy - used by existing routes until Phase 3 migration)
 */
export function validateUsername(username: string): string | null {
  if (!username || typeof username !== 'string') {
    return 'username is required';
  }
  if (username.length < 1 || username.length > 32) {
    return 'username must be 1-32 characters';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'username must be alphanumeric with _ or -';
  }
  return null;
}

const RESERVED_NAMES = ['admin', 'aims', 'system', 'bot', 'root', 'mod', 'moderator', 'support', 'help', 'info', 'null', 'undefined'];

/**
 * Validate bot username for self-serve registration.
 * Returns null if valid, error message if invalid.
 * (Legacy - used by existing routes until Phase 3 migration)
 */
export function validateBotUsername(username: string): string | null {
  if (!username || typeof username !== 'string') {
    return 'Username is required';
  }
  if (username.length < 3 || username.length > 20) {
    return 'Username must be 3-20 characters';
  }
  if (!/^[a-z][a-z0-9-]*$/.test(username)) {
    return 'Username must start with a letter and contain only lowercase alphanumeric characters and hyphens';
  }
  if (RESERVED_NAMES.includes(username)) {
    return 'This username is reserved';
  }
  return null;
}
