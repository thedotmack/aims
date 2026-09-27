import { generateId, sql, ensureContactTables } from './db';
import {
  hashSecret,
  mintClaimSecret,
  mintDisplayClaimCode,
  mintReplyToken,
  normalizeClaimCode,
} from './crypto-tokens';
import { DISCORD_REPLY_WINDOW_MS } from './discord-loop';

export const CLAIM_TTL_MS = 15 * 60 * 1000;
export const NONCE_TTL_HOURS = 24;

export interface DiscordBinding {
  id: string;
  pageId: string;
  guildId: string;
  channelId: string;
  mentionHandle: string;
  createdAt: string;
}

export interface DiscordClaim {
  id: string;
  codeHash: string;
  secretHash: string;
  pageId: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function rowToBinding(row: Record<string, unknown>): DiscordBinding {
  return {
    id: String(row.id),
    pageId: String(row.page_id),
    guildId: String(row.guild_id),
    channelId: String(row.channel_id),
    mentionHandle: String(row.mention_handle),
    createdAt: asIso(row.created_at),
  };
}

export function slugifyHandle(name: string): string {
  const handle = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '')
    .slice(0, 32);
  return handle || 'bot';
}

export async function createClaim(pageId: string): Promise<{
  id: string;
  claim: string;
  claimSecret: string;
  expiresAt: string;
}> {
  await ensureContactTables();
  const id = generateId('clm');
  const claim = mintDisplayClaimCode();
  const claimSecret = mintClaimSecret();
  const expiresAt = new Date(Date.now() + CLAIM_TTL_MS).toISOString();
  await sql`
    INSERT INTO discord_claims (id, code_hash, secret_hash, page_id, expires_at)
    VALUES (${id}, ${hashSecret(normalizeClaimCode(claim))}, ${hashSecret(claimSecret)}, ${pageId}, ${expiresAt})
  `;
  return { id, claim, claimSecret, expiresAt };
}

export async function getClaimByCode(code: string): Promise<DiscordClaim | null> {
  await ensureContactTables();
  const rows = await sql`
    SELECT * FROM discord_claims WHERE code_hash = ${hashSecret(normalizeClaimCode(code))} LIMIT 1
  `;
  return rows[0] ? rowToClaim(rows[0] as Record<string, unknown>) : null;
}

export async function getClaimBySecret(secret: string): Promise<DiscordClaim | null> {
  await ensureContactTables();
  const rows = await sql`
    SELECT * FROM discord_claims WHERE secret_hash = ${hashSecret(secret)} LIMIT 1
  `;
  return rows[0] ? rowToClaim(rows[0] as Record<string, unknown>) : null;
}

function rowToClaim(row: Record<string, unknown>): DiscordClaim {
  return {
    id: String(row.id),
    codeHash: String(row.code_hash),
    secretHash: String(row.secret_hash),
    pageId: String(row.page_id),
    expiresAt: asIso(row.expires_at),
    consumedAt: row.consumed_at ? asIso(row.consumed_at) : null,
    createdAt: asIso(row.created_at),
  };
}

export function claimStatus(claim: DiscordClaim, now = Date.now()): 'pending' | 'bound' | 'expired' {
  if (claim.consumedAt) return 'bound';
  if (new Date(claim.expiresAt).getTime() <= now) return 'expired';
  return 'pending';
}

export async function consumeClaim(claimId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE discord_claims
    SET consumed_at = NOW()
    WHERE id = ${claimId} AND consumed_at IS NULL AND expires_at > NOW()
    RETURNING id
  `;
  return rows.length > 0;
}

export async function upsertDiscordBinding(input: {
  pageId: string;
  guildId: string;
  channelId: string;
  mentionHandle: string;
}): Promise<DiscordBinding> {
  await ensureContactTables();
  const handle = input.mentionHandle.toLowerCase();
  const existing = await sql`
    SELECT * FROM discord_bindings
    WHERE guild_id = ${input.guildId} AND mention_handle = ${handle}
    LIMIT 1
  `;
  if (existing[0]) {
    const rows = await sql`
      UPDATE discord_bindings
      SET channel_id = ${input.channelId}, page_id = ${input.pageId}, mention_handle = ${handle}
      WHERE id = ${(existing[0] as { id: string }).id}
      RETURNING *
    `;
    return rowToBinding(rows[0] as Record<string, unknown>);
  }
  const id = generateId('dbnd');
  const rows = await sql`
    INSERT INTO discord_bindings (id, page_id, guild_id, channel_id, mention_handle)
    VALUES (${id}, ${input.pageId}, ${input.guildId}, ${input.channelId}, ${handle})
    RETURNING *
  `;
  return rowToBinding(rows[0] as Record<string, unknown>);
}

export async function deleteDiscordBindingsForPage(pageId: string): Promise<number> {
  await ensureContactTables();
  const rows = await sql`DELETE FROM discord_bindings WHERE page_id = ${pageId} RETURNING id`;
  return rows.length;
}

export async function getBindingsForPage(pageId: string): Promise<DiscordBinding[]> {
  await ensureContactTables();
  const rows = await sql`
    SELECT * FROM discord_bindings WHERE page_id = ${pageId} ORDER BY created_at DESC
  `;
  return rows.map((row) => rowToBinding(row as Record<string, unknown>));
}

export async function getBindingForPage(pageId: string): Promise<DiscordBinding | null> {
  const list = await getBindingsForPage(pageId);
  return list[0] || null;
}

export async function resolveDiscordBinding(input: {
  guildId: string;
  channelId: string;
  handle: string | null;
}): Promise<DiscordBinding | null> {
  await ensureContactTables();
  if (input.handle) {
    const exact = await sql`
      SELECT * FROM discord_bindings
      WHERE guild_id = ${input.guildId} AND mention_handle = ${input.handle.toLowerCase()}
      ORDER BY CASE WHEN channel_id = ${input.channelId} THEN 0 ELSE 1 END
      LIMIT 1
    `;
    if (exact[0]) return rowToBinding(exact[0] as Record<string, unknown>);
  }
  const channelOnly = await sql`
    SELECT * FROM discord_bindings
    WHERE guild_id = ${input.guildId} AND channel_id = ${input.channelId}
  `;
  if (channelOnly.length === 1) return rowToBinding(channelOnly[0] as Record<string, unknown>);
  return null;
}

export async function rememberEventNonce(nonce: string, messageId: string | null): Promise<{ ok: true } | { ok: false; reason: 'nonce' | 'message' }> {
  await ensureContactTables();
  try {
    await sql`
      INSERT INTO discord_event_nonces (nonce, message_id)
      VALUES (${nonce}, ${messageId})
    `;
    return { ok: true };
  } catch {
    if (messageId) {
      const existing = await sql`
        SELECT nonce FROM discord_event_nonces WHERE message_id = ${messageId} LIMIT 1
      `;
      if (existing[0]) return { ok: false, reason: 'message' };
    }
    return { ok: false, reason: 'nonce' };
  }
}

export async function messageIdSeen(messageId: string): Promise<boolean> {
  await ensureContactTables();
  const rows = await sql`
    SELECT nonce FROM discord_event_nonces WHERE message_id = ${messageId} LIMIT 1
  `;
  return rows.length > 0;
}

export async function createReplySecret(messageId: string): Promise<{ token: string; expiresAt: string }> {
  const token = mintReplyToken();
  const expiresAt = new Date(Date.now() + DISCORD_REPLY_WINDOW_MS).toISOString();
  await sql`
    UPDATE contact_messages
    SET reply_token_hash = ${hashSecret(token)}, reply_expires_at = ${expiresAt}
    WHERE id = ${messageId}
  `;
  return { token, expiresAt };
}

export async function getParentHopForReference(sourceMessageId: string): Promise<number | null> {
  await ensureContactTables();
  const rows = await sql`
    SELECT hop FROM contact_messages
    WHERE discord_reply_message_id = ${sourceMessageId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const hop = Number((rows[0] as { hop?: number }).hop);
  return Number.isFinite(hop) ? hop : 0;
}

export async function isPairCoolingDown(key: string): Promise<boolean> {
  await ensureContactTables();
  const rows = await sql`
    SELECT pair_key FROM discord_cooldowns
    WHERE pair_key = ${key} AND seen_at > NOW() - INTERVAL '30 seconds'
    LIMIT 1
  `;
  if (rows[0]) return true;
  await sql`
    INSERT INTO discord_cooldowns (pair_key, seen_at)
    VALUES (${key}, NOW())
    ON CONFLICT (pair_key) DO UPDATE SET seen_at = NOW()
  `;
  return false;
}

export async function countClaimsForPageLastHour(pageId: string): Promise<number> {
  await ensureContactTables();
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM discord_claims
    WHERE page_id = ${pageId} AND created_at > NOW() - INTERVAL '1 hour'
  `;
  return Number((rows[0] as { count: number })?.count || 0);
}
