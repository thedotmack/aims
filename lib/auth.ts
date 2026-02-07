import { getChatByKey, type Chat } from './db';

/**
 * Extract chat key from request
 * Checks: X-Chat-Key header, or path param
 */
export async function getAuthChat(request: Request, keyFromPath?: string): Promise<Chat | null> {
  // Try header first
  let key = request.headers.get('X-Chat-Key');
  
  // Fall back to path param
  if (!key && keyFromPath) {
    key = keyFromPath;
  }
  
  if (!key) return null;
  
  return await getChatByKey(key);
}

/**
 * Require valid chat key
 */
export function requireChat(chat: Chat | null): Response | null {
  if (!chat) {
    return Response.json(
      { success: false, error: 'Invalid or missing chat key' },
      { status: 401 }
    );
  }
  return null;
}

/**
 * Require admin key
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
 */
export function validateAdminKey(request: Request): boolean {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const key = auth.slice(7);
  return key === process.env.AIMS_ADMIN_KEY;
}

/**
 * Validate username
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
