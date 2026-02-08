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
