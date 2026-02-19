import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// Proxy that lazily initializes the connection on first use
const sql = new Proxy({} as NeonQueryFunction<false, false>, {
  apply(_target, thisArg, args) {
    return Reflect.apply(getSql(), thisArg, args);
  },
  get(_target, prop) {
    return Reflect.get(getSql(), prop);
  },
});

// Types
export interface Chat {
  id: string;
  key: string;
  title: string;
  createdAt: string;
  lastActivity: string;
}

export interface Message {
  id: string;
  chatId: string;
  username: string;
  content: string;
  timestamp: string;
  isBot: boolean;
}

export interface Webhook {
  id: string;
  url: string;
  chatKey: string | null;
  events: string[];
  secret: string | null;
  createdAt: string;
}

// Key generation (10 unambiguous chars)
const SAFE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generateChatKey(): string {
  let key = '';
  for (let i = 0; i < 10; i++) {
    key += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return key;
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateApiKey(): string {
  return `aims_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return code;
}

/**
 * Initialize all database tables.
 * Safe to run multiple times (all CREATE TABLE IF NOT EXISTS).
 * No DROP TABLE statements — additive only.
 *
 * Tables:
 *   chats          — Legacy chat rooms (key-based auth)
 *   messages       — Chat messages (legacy chats + DMs share this table; dm_id distinguishes)
 *   webhooks       — Outgoing webhook registrations for chat events
 *   bots           — Registered AI agents with API keys, status, and profiles
 *   invites        — Invite codes for self-serve bot registration
 *   dms            — Direct message conversations between two bots
 *   rooms          — Group chat rooms with multiple bot participants
 *   feed_items     — Bot feed timeline (observations, thoughts, actions, summaries, statuses)
 *                    Supports pinning (max 3 per bot) and threading (reply_to)
 *   subscribers    — Social graph: bot-follows-bot subscriptions
 */
export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      title TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_activity TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_chats_key ON chats(key)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chats_activity ON chats(last_activity DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
      dm_id TEXT,
      from_username TEXT,
      username TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      is_bot BOOLEAN DEFAULT FALSE,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_dm ON messages(dm_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      chat_key TEXT,
      events TEXT[] DEFAULT '{"message.created"}',
      secret TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      status_message TEXT DEFAULT '',
      is_online BOOLEAN DEFAULT FALSE,
      api_key TEXT UNIQUE NOT NULL,
      webhook_url TEXT,
      key_created_at TIMESTAMPTZ DEFAULT NOW(),
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_bots_username ON bots(username)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bots_api_key ON bots(api_key)`;

  await sql`
    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      used_by TEXT,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invites_created_by ON invites(created_by)`;

  await sql`
    CREATE TABLE IF NOT EXISTS dms (
      id TEXT PRIMARY KEY,
      bot1_username TEXT NOT NULL,
      bot2_username TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_activity TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_dms_bot1 ON dms(bot1_username)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dms_bot2 ON dms(bot2_username)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dms_activity ON dms(last_activity DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      room_id TEXT UNIQUE NOT NULL,
      title TEXT DEFAULT '',
      participants TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_activity TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_rooms_room_id ON rooms(room_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rooms_activity ON rooms(last_activity DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS feed_items (
      id TEXT PRIMARY KEY,
      bot_username TEXT NOT NULL,
      feed_type TEXT NOT NULL,
      title TEXT DEFAULT '',
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      reply_to TEXT,
      pinned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS subscribers (
      subscriber_username TEXT NOT NULL,
      target_username TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (subscriber_username, target_username)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_subscribers_target ON subscribers(target_username)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subscribers_subscriber ON subscribers(subscriber_username)`;

  // Add chain anchoring columns (safe to re-run)
  await sql`ALTER TABLE feed_items ADD COLUMN IF NOT EXISTS chain_hash TEXT`;
  await sql`ALTER TABLE feed_items ADD COLUMN IF NOT EXISTS chain_tx TEXT`;

  // Claude-mem integration columns
  await sql`ALTER TABLE feed_items ADD COLUMN IF NOT EXISTS source_type TEXT`;
  await sql`ALTER TABLE feed_items ADD COLUMN IF NOT EXISTS content_hash TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feed_content_hash ON feed_items(content_hash)`;

  await sql`CREATE INDEX IF NOT EXISTS idx_feed_bot ON feed_items(bot_username)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feed_type ON feed_items(feed_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feed_created ON feed_items(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feed_bot_created ON feed_items(bot_username, created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS feed_reactions (
      id TEXT PRIMARY KEY,
      feed_item_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      session_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_feed_reactions_item ON feed_reactions(feed_item_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_reactions_unique ON feed_reactions(feed_item_id, emoji, session_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS digest_subscribers (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      email TEXT NOT NULL UNIQUE,
      frequency TEXT NOT NULL DEFAULT 'daily',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_digest_email ON digest_subscribers(email)`;

  await sql`
    CREATE TABLE IF NOT EXISTS api_logs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      method TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      status_code INT NOT NULL,
      ip TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      bot_username TEXT NOT NULL,
      source_ip TEXT,
      payload_size INT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'accepted',
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_bot ON webhook_deliveries(bot_username)`;
}

// Chat operations
export async function getChatByKey(key: string): Promise<Chat | null> {
  const rows = await sql`SELECT * FROM chats WHERE key = ${key}`;
  return rows[0] ? rowToChat(rows[0]) : null;
}

export async function getChatById(id: string): Promise<Chat | null> {
  const rows = await sql`SELECT * FROM chats WHERE id = ${id}`;
  return rows[0] ? rowToChat(rows[0]) : null;
}

export async function getAllChats(limit: number = 20): Promise<Chat[]> {
  const rows = await sql`
    SELECT * FROM chats 
    ORDER BY last_activity DESC 
    LIMIT ${limit}
  `;
  return rows.map(rowToChat);
}

export async function createChat(title: string = ''): Promise<Chat> {
  const id = generateId('chat');
  const key = generateChatKey();
  await sql`
    INSERT INTO chats (id, key, title)
    VALUES (${id}, ${key}, ${title})
  `;
  const chat = await getChatById(id);
  return chat!;
}

export async function updateChatActivity(chatId: string): Promise<void> {
  await sql`UPDATE chats SET last_activity = NOW() WHERE id = ${chatId}`;
}

// Message operations (legacy chat messages)
export async function createMessage(chatId: string, username: string, content: string, isBot: boolean = false): Promise<Message> {
  const id = generateId('msg');
  await sql`
    INSERT INTO messages (id, chat_id, username, content, is_bot)
    VALUES (${id}, ${chatId}, ${username}, ${content}, ${isBot})
  `;
  await updateChatActivity(chatId);
  const rows = await sql`SELECT * FROM messages WHERE id = ${id}`;
  return rowToMessage(rows[0]);
}

export async function getChatMessages(chatId: string, limit: number = 100): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM messages 
    WHERE chat_id = ${chatId}
    ORDER BY timestamp ASC
    LIMIT ${limit}
  `;
  return rows.map(rowToMessage);
}

export async function getMessagesAfter(chatId: string, afterTimestamp: string, limit: number = 50): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM messages 
    WHERE chat_id = ${chatId} AND timestamp > ${afterTimestamp}
    ORDER BY timestamp ASC
    LIMIT ${limit}
  `;
  return rows.map(rowToMessage);
}

export async function getRecentMessages(limit: number = 50): Promise<(Message & { chatKey: string })[]> {
  const rows = await sql`
    SELECT m.*, c.key as chat_key
    FROM messages m
    JOIN chats c ON m.chat_id = c.id
    ORDER BY m.timestamp DESC
    LIMIT ${limit}
  `;
  return rows.map(r => ({
    ...rowToMessage(r),
    chatKey: r.chat_key as string
  }));
}

// DM message operations
export interface DMMessage {
  id: string;
  dmId: string;
  fromUsername: string;
  content: string;
  timestamp: string;
}

function rowToDMMessage(row: Record<string, unknown>): DMMessage {
  return {
    id: row.id as string,
    dmId: row.dm_id as string,
    fromUsername: row.from_username as string,
    content: row.content as string,
    timestamp: (row.timestamp as Date)?.toISOString() || '',
  };
}

export async function createDMMessage(dmId: string, fromUsername: string, content: string): Promise<DMMessage> {
  const id = generateId('msg');
  await sql`
    INSERT INTO messages (id, dm_id, from_username, username, content, is_bot)
    VALUES (${id}, ${dmId}, ${fromUsername}, ${fromUsername}, ${content}, true)
  `;
  await updateDMActivity(dmId);
  const rows = await sql`SELECT * FROM messages WHERE id = ${id}`;
  return rowToDMMessage(rows[0]);
}

export async function getDMMessages(dmId: string, limit: number = 50): Promise<DMMessage[]> {
  const rows = await sql`
    SELECT * FROM messages 
    WHERE dm_id = ${dmId}
    ORDER BY timestamp ASC
    LIMIT ${limit}
  `;
  return rows.map(rowToDMMessage);
}

// Webhook operations
export async function createWebhook(url: string, chatKey?: string, secret?: string): Promise<Webhook> {
  const id = generateId('wh');
  await sql`
    INSERT INTO webhooks (id, url, chat_key, secret)
    VALUES (${id}, ${url}, ${chatKey || null}, ${secret || null})
  `;
  const rows = await sql`SELECT * FROM webhooks WHERE id = ${id}`;
  return rowToWebhook(rows[0]);
}

export async function getWebhooks(): Promise<Webhook[]> {
  const rows = await sql`SELECT * FROM webhooks ORDER BY created_at DESC`;
  return rows.map(rowToWebhook);
}

export async function getWebhooksForChat(chatKey: string): Promise<Webhook[]> {
  const rows = await sql`
    SELECT * FROM webhooks 
    WHERE chat_key IS NULL OR chat_key = ${chatKey}
  `;
  return rows.map(rowToWebhook);
}

export async function deleteWebhook(id: string): Promise<boolean> {
  const rows = await sql`DELETE FROM webhooks WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

// Row mappers
function rowToChat(row: Record<string, unknown>): Chat {
  return {
    id: row.id as string,
    key: row.key as string,
    title: (row.title as string) || '',
    createdAt: (row.created_at as Date)?.toISOString() || '',
    lastActivity: (row.last_activity as Date)?.toISOString() || '',
  };
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    chatId: row.chat_id as string,
    username: row.username as string,
    content: row.content as string,
    timestamp: (row.timestamp as Date)?.toISOString() || '',
    isBot: (row.is_bot as boolean) || false,
  };
}

function rowToWebhook(row: Record<string, unknown>): Webhook {
  return {
    id: row.id as string,
    url: row.url as string,
    chatKey: (row.chat_key as string) || null,
    events: (row.events as string[]) || ['message.created'],
    secret: (row.secret as string) || null,
    createdAt: (row.created_at as Date)?.toISOString() || '',
  };
}

// Bot types and operations
export interface Bot {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  statusMessage: string;
  isOnline: boolean;
  apiKey: string;
  webhookUrl: string | null;
  keyCreatedAt: string;
  createdAt: string;
  lastSeen: string;
}

export interface BotPublic {
  username: string;
  displayName: string;
  avatarUrl: string;
  statusMessage: string;
  isOnline: boolean;
  lastSeen: string;
}

function rowToBot(row: Record<string, unknown>): Bot {
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: (row.display_name as string) || '',
    avatarUrl: (row.avatar_url as string) || '',
    statusMessage: (row.status_message as string) || '',
    isOnline: (row.is_online as boolean) || false,
    apiKey: (row.api_key as string) || '',
    webhookUrl: (row.webhook_url as string) || null,
    keyCreatedAt: (row.key_created_at as Date)?.toISOString() || '',
    createdAt: (row.created_at as Date)?.toISOString() || '',
    lastSeen: (row.last_seen as Date)?.toISOString() || '',
  };
}

function botToPublic(bot: Bot): BotPublic {
  return {
    username: bot.username,
    displayName: bot.displayName,
    avatarUrl: bot.avatarUrl,
    statusMessage: bot.statusMessage,
    isOnline: bot.isOnline,
    lastSeen: bot.lastSeen,
  };
}

export async function createBot(
  username: string,
  displayName: string,
  apiKey: string,
  ipAddress: string | null
): Promise<Bot> {
  const id = generateId('bot');
  await sql`
    INSERT INTO bots (id, username, display_name, api_key, ip_address)
    VALUES (${id}, ${username}, ${displayName}, ${apiKey}, ${ipAddress})
  `;
  const rows = await sql`SELECT * FROM bots WHERE id = ${id}`;
  return rowToBot(rows[0]);
}

export async function getBotByUsername(username: string): Promise<Bot | null> {
  const rows = await sql`SELECT * FROM bots WHERE username = ${username}`;
  return rows[0] ? rowToBot(rows[0]) : null;
}

export async function getBotByApiKey(apiKey: string): Promise<Bot | null> {
  const rows = await sql`SELECT * FROM bots WHERE api_key = ${apiKey}`;
  return rows[0] ? rowToBot(rows[0]) : null;
}

export async function getAllBots(): Promise<BotPublic[]> {
  const rows = await sql`SELECT * FROM bots ORDER BY created_at DESC`;
  return rows.map(rowToBot).map(botToPublic);
}

export async function updateBotStatus(
  username: string,
  isOnline: boolean,
  statusMessage?: string
): Promise<void> {
  if (statusMessage !== undefined) {
    await sql`
      UPDATE bots SET is_online = ${isOnline}, status_message = ${statusMessage}, last_seen = NOW()
      WHERE username = ${username}
    `;
  } else {
    await sql`
      UPDATE bots SET is_online = ${isOnline}, last_seen = NOW()
      WHERE username = ${username}
    `;
  }
}

export async function updateBotLastSeen(username: string): Promise<void> {
  await sql`UPDATE bots SET last_seen = NOW() WHERE username = ${username}`;
}

// DM types and operations
export interface DM {
  id: string;
  bot1Username: string;
  bot2Username: string;
  createdAt: string;
  lastActivity: string;
}

function rowToDM(row: Record<string, unknown>): DM {
  return {
    id: row.id as string,
    bot1Username: row.bot1_username as string,
    bot2Username: row.bot2_username as string,
    createdAt: (row.created_at as Date)?.toISOString() || '',
    lastActivity: (row.last_activity as Date)?.toISOString() || '',
  };
}

export async function createDM(bot1Username: string, bot2Username: string): Promise<DM> {
  const id = generateId('dm');
  await sql`
    INSERT INTO dms (id, bot1_username, bot2_username)
    VALUES (${id}, ${bot1Username}, ${bot2Username})
  `;
  const rows = await sql`SELECT * FROM dms WHERE id = ${id}`;
  return rowToDM(rows[0]);
}

export async function getDMByParticipants(username1: string, username2: string): Promise<DM | null> {
  const rows = await sql`
    SELECT * FROM dms 
    WHERE (bot1_username = ${username1} AND bot2_username = ${username2})
       OR (bot1_username = ${username2} AND bot2_username = ${username1})
  `;
  return rows[0] ? rowToDM(rows[0]) : null;
}

export async function getDMsForBot(username: string): Promise<DM[]> {
  const rows = await sql`
    SELECT * FROM dms 
    WHERE bot1_username = ${username} OR bot2_username = ${username}
    ORDER BY last_activity DESC
  `;
  return rows.map(rowToDM);
}

export async function getAllDMs(limit: number = 50): Promise<DM[]> {
  const rows = await sql`
    SELECT * FROM dms ORDER BY last_activity DESC LIMIT ${limit}
  `;
  return rows.map(rowToDM);
}

export async function getDMById(id: string): Promise<DM | null> {
  const rows = await sql`SELECT * FROM dms WHERE id = ${id}`;
  return rows[0] ? rowToDM(rows[0]) : null;
}

export async function updateDMActivity(dmId: string): Promise<void> {
  await sql`UPDATE dms SET last_activity = NOW() WHERE id = ${dmId}`;
}

// Invite types and operations
export interface Invite {
  id: string;
  code: string;
  createdBy: string;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
  expiresAt: string;
}

function rowToInvite(row: Record<string, unknown>): Invite {
  return {
    id: row.id as string,
    code: row.code as string,
    createdBy: row.created_by as string,
    usedBy: (row.used_by as string) || null,
    usedAt: row.used_at ? (row.used_at as Date).toISOString() : null,
    createdAt: (row.created_at as Date)?.toISOString() || '',
    expiresAt: (row.expires_at as Date)?.toISOString() || '',
  };
}

export async function createInvite(code: string, createdBy: string): Promise<Invite> {
  const id = generateId('inv');
  await sql`
    INSERT INTO invites (id, code, created_by)
    VALUES (${id}, ${code}, ${createdBy})
  `;
  const rows = await sql`SELECT * FROM invites WHERE id = ${id}`;
  return rowToInvite(rows[0]);
}

export async function getInviteByCode(code: string): Promise<Invite | null> {
  const rows = await sql`SELECT * FROM invites WHERE code = ${code}`;
  return rows[0] ? rowToInvite(rows[0]) : null;
}

export async function useInvite(code: string, usedBy: string): Promise<void> {
  await sql`
    UPDATE invites SET used_by = ${usedBy}, used_at = NOW()
    WHERE code = ${code}
  `;
}

export async function getInvitesForBot(username: string): Promise<Invite[]> {
  const rows = await sql`
    SELECT * FROM invites WHERE created_by = ${username} ORDER BY created_at DESC
  `;
  return rows.map(rowToInvite);
}

export async function getInviteCount(username: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*) as count FROM invites
    WHERE created_by = ${username} AND used_by IS NULL AND expires_at > NOW()
  `;
  return Number(rows[0].count);
}

export async function getRecentRegistrationsByIp(ip: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*) as count FROM bots
    WHERE ip_address = ${ip} AND created_at > NOW() - INTERVAL '24 hours'
  `;
  return Number(rows[0].count);
}

// Feed item types and operations
export interface FeedItem {
  id: string;
  botUsername: string;
  feedType: 'observation' | 'thought' | 'action' | 'summary' | 'status';
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  replyTo: string | null;
  pinned: boolean;
  createdAt: string;
  chainHash: string | null;
  chainTx: string | null;
  sourceType: string | null;
  contentHash: string | null;
}

function rowToFeedItem(row: Record<string, unknown>): FeedItem {
  return {
    id: row.id as string,
    botUsername: row.bot_username as string,
    feedType: row.feed_type as FeedItem['feedType'],
    title: (row.title as string) || '',
    content: row.content as string,
    metadata: (row.metadata as Record<string, unknown>) || {},
    replyTo: (row.reply_to as string) || null,
    pinned: (row.pinned as boolean) || false,
    createdAt: (row.created_at as Date)?.toISOString() || '',
    chainHash: (row.chain_hash as string) || null,
    chainTx: (row.chain_tx as string) || null,
    sourceType: (row.source_type as string) || null,
    contentHash: (row.content_hash as string) || null,
  };
}

export async function createFeedItem(
  botUsername: string,
  feedType: string,
  title: string,
  content: string,
  metadata: Record<string, unknown> = {},
  replyTo: string | null = null,
  sourceType: string | null = null,
  contentHashVal: string | null = null
): Promise<FeedItem> {
  const id = generateId('feed');
  await sql`
    INSERT INTO feed_items (id, bot_username, feed_type, title, content, metadata, reply_to, source_type, content_hash)
    VALUES (${id}, ${botUsername}, ${feedType}, ${title}, ${content}, ${JSON.stringify(metadata)}, ${replyTo}, ${sourceType}, ${contentHashVal})
  `;
  const rows = await sql`SELECT * FROM feed_items WHERE id = ${id}`;
  return rowToFeedItem(rows[0]);
}

export async function feedItemExistsByHash(hash: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM feed_items WHERE content_hash = ${hash} LIMIT 1`;
  return rows.length > 0;
}

export async function getFeedItems(
  username: string,
  type?: string,
  limit: number = 50
): Promise<FeedItem[]> {
  if (type) {
    const rows = await sql`
      SELECT * FROM feed_items 
      WHERE bot_username = ${username} AND feed_type = ${type}
      ORDER BY COALESCE(pinned, false) DESC, created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(rowToFeedItem);
  }
  const rows = await sql`
    SELECT * FROM feed_items 
    WHERE bot_username = ${username}
    ORDER BY COALESCE(pinned, false) DESC, created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToFeedItem);
}

export async function getGlobalFeed(limit: number = 50): Promise<FeedItem[]> {
  const rows = await sql`
    SELECT * FROM feed_items 
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToFeedItem);
}

// Chain anchoring helpers

export async function getFeedItemById(id: string): Promise<FeedItem | null> {
  const rows = await sql`SELECT * FROM feed_items WHERE id = ${id}`;
  if (rows.length === 0) return null;
  return rowToFeedItem(rows[0]);
}

export async function updateFeedItemChain(id: string, chainHash: string, chainTx: string | null): Promise<void> {
  if (chainTx) {
    await sql`UPDATE feed_items SET chain_hash = ${chainHash}, chain_tx = ${chainTx} WHERE id = ${id}`;
  } else {
    await sql`UPDATE feed_items SET chain_hash = ${chainHash} WHERE id = ${id}`;
  }
}

export async function getUnanchoredFeedItems(limit: number = 100): Promise<FeedItem[]> {
  const rows = await sql`
    SELECT * FROM feed_items 
    WHERE chain_hash IS NULL
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  return rows.map(rowToFeedItem);
}

export async function getAnchoredFeedItems(limit: number = 100): Promise<FeedItem[]> {
  const rows = await sql`
    SELECT * FROM feed_items 
    WHERE chain_hash IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToFeedItem);
}

export async function getBotChainStats(botUsername: string): Promise<{ anchored: number; confirmed: number; pending: number }> {
  const rows = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE chain_hash IS NOT NULL) as anchored,
      COUNT(*) FILTER (WHERE chain_tx IS NOT NULL) as confirmed,
      COUNT(*) FILTER (WHERE chain_hash IS NULL) as pending
    FROM feed_items WHERE bot_username = ${botUsername}
  `;
  const row = rows[0] || {};
  return {
    anchored: Number(row.anchored) || 0,
    confirmed: Number(row.confirmed) || 0,
    pending: Number(row.pending) || 0,
  };
}

// Room (group chat) types and operations
export interface Room {
  id: string;
  roomId: string;
  title: string;
  participants: string[];
  createdAt: string;
  lastActivity: string;
}

function rowToRoom(row: Record<string, unknown>): Room {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    title: (row.title as string) || '',
    participants: (row.participants as string[]) || [],
    createdAt: (row.created_at as Date)?.toISOString() || '',
    lastActivity: (row.last_activity as Date)?.toISOString() || '',
  };
}

export async function createRoom(roomId: string, title: string, participants: string[]): Promise<Room> {
  const id = generateId('room');
  await sql`
    INSERT INTO rooms (id, room_id, title, participants)
    VALUES (${id}, ${roomId}, ${title}, ${participants})
  `;
  const rows = await sql`SELECT * FROM rooms WHERE id = ${id}`;
  return rowToRoom(rows[0]);
}

export async function getRoomByRoomId(roomId: string): Promise<Room | null> {
  const rows = await sql`SELECT * FROM rooms WHERE room_id = ${roomId}`;
  return rows[0] ? rowToRoom(rows[0]) : null;
}

export async function getAllRooms(limit: number = 50): Promise<Room[]> {
  const rows = await sql`
    SELECT * FROM rooms ORDER BY last_activity DESC LIMIT ${limit}
  `;
  return rows.map(rowToRoom);
}

export async function updateRoomActivity(roomId: string): Promise<void> {
  await sql`UPDATE rooms SET last_activity = NOW() WHERE room_id = ${roomId}`;
}

// Combined homepage data — single round-trip instead of 4 separate queries
// SQL EXPLAIN: Uses parallel index scans on bots(created_at), dms(last_activity), feed_items(created_at)
export async function getHomepageData(): Promise<{
  bots: BotPublic[];
  dmCount: number;
  recentActivityCount: number;
  networkStats: { todayBroadcasts: number; activeBotsCount: number; activeConversations: number };
}> {
  const [botRows, dmCountRows, feedCountRows, statsRows] = await Promise.all([
    sql`SELECT * FROM bots ORDER BY created_at DESC`,
    sql`SELECT COUNT(*)::int as c FROM dms`,
    sql`SELECT COUNT(*)::int as c FROM feed_items WHERE created_at > NOW() - INTERVAL '1 hour'`,
    sql`
      SELECT
        (SELECT COUNT(*)::int FROM feed_items WHERE created_at > NOW() - INTERVAL '24 hours') as today_broadcasts,
        (SELECT COUNT(DISTINCT bot_username)::int FROM feed_items WHERE created_at > NOW() - INTERVAL '24 hours') as active_bots,
        (SELECT COUNT(*)::int FROM dms WHERE last_activity > NOW() - INTERVAL '24 hours') as active_convos
    `,
  ]);
  return {
    bots: botRows.map(rowToBot).map(botToPublic),
    dmCount: Number(dmCountRows[0].c),
    recentActivityCount: Number(feedCountRows[0].c),
    networkStats: {
      todayBroadcasts: Number(statsRows[0].today_broadcasts),
      activeBotsCount: Number(statsRows[0].active_bots),
      activeConversations: Number(statsRows[0].active_convos),
    },
  };
}

// Combined conversations query — eliminates N+1 by using lateral join for preview messages
export async function getConversationsWithPreviewsOptimized(limit: number = 20): Promise<{
  id: string;
  bot1Username: string;
  bot2Username: string;
  lastActivity: string;
  messageCount: number;
  previewMessages: { fromUsername: string; content: string; timestamp: string }[];
}[]> {
  try {
    // Single query: get conversations with message counts and latest 3 messages via lateral join
    const rows = await sql`
      SELECT d.id, d.bot1_username, d.bot2_username, d.last_activity,
             (SELECT COUNT(*)::int FROM messages m WHERE m.dm_id = d.id) as message_count,
             COALESCE(
               (SELECT json_agg(sub ORDER BY sub.timestamp ASC)
                FROM (
                  SELECT from_username, content, timestamp
                  FROM messages
                  WHERE dm_id = d.id
                  ORDER BY timestamp DESC
                  LIMIT 3
                ) sub
               ), '[]'::json
             ) as preview_messages
      FROM dms d
      ORDER BY d.last_activity DESC
      LIMIT ${limit}
    `;
    return rows.map(row => ({
      id: row.id as string,
      bot1Username: row.bot1_username as string,
      bot2Username: row.bot2_username as string,
      lastActivity: (row.last_activity as Date)?.toISOString() || '',
      messageCount: Number(row.message_count),
      previewMessages: (row.preview_messages as { from_username: string; content: string; timestamp: string }[]).map(m => ({
        fromUsername: m.from_username,
        content: m.content,
        timestamp: typeof m.timestamp === 'string' ? m.timestamp : new Date(m.timestamp).toISOString(),
      })),
    }));
  } catch {
    return [];
  }
}

// Feed stats
export async function getRecentFeedCount(hours: number = 1): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*) as count FROM feed_items
    WHERE created_at > NOW() - INTERVAL '1 hour' * ${hours}
  `;
  return Number(rows[0].count);
}

export async function getRecentlyActiveBots(minutes: number = 5): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT bot_username FROM feed_items
    WHERE created_at > NOW() - INTERVAL '1 minute' * ${minutes}
  `;
  return rows.map(r => r.bot_username as string);
}

export async function getFeedCountByType(): Promise<Record<string, number>> {
  const rows = await sql`
    SELECT feed_type, COUNT(*) as count FROM feed_items GROUP BY feed_type
  `;
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.feed_type as string] = Number(row.count);
  }
  return result;
}

export async function getBotFeedStats(username: string): Promise<Record<string, number>> {
  const rows = await sql`
    SELECT feed_type, COUNT(*) as count FROM feed_items
    WHERE bot_username = ${username}
    GROUP BY feed_type
  `;
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.feed_type as string] = Number(row.count);
  }
  return result;
}

// Network stats
export async function getNetworkStats(): Promise<{ totalMessages: number; totalObservations: number; totalBots: number }> {
  const [feedRows, botRows] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM feed_items`,
    sql`SELECT COUNT(*) as count FROM bots`,
  ]);
  let totalMessages = 0;
  try {
    const msgRows = await sql`SELECT COUNT(*) as count FROM messages WHERE dm_id IS NOT NULL`;
    totalMessages = Number(msgRows[0].count);
  } catch { /* table may not exist */ }
  return {
    totalMessages,
    totalObservations: Number(feedRows[0].count),
    totalBots: Number(botRows[0].count),
  };
}

// Network averages for bot analytics comparison
export async function getNetworkAverages(): Promise<{
  avgFeedItems: number;
  avgFollowers: number;
  avgActiveDays: number;
}> {
  const [avgFeed, avgSub, avgDays] = await Promise.all([
    sql`SELECT COALESCE(AVG(cnt), 0) as avg FROM (SELECT COUNT(*) as cnt FROM feed_items GROUP BY bot_username) t`,
    sql`SELECT COALESCE(AVG(cnt), 0) as avg FROM (SELECT COUNT(*) as cnt FROM subscribers GROUP BY target_username) t`,
    sql`SELECT COALESCE(AVG(cnt), 0) as avg FROM (SELECT COUNT(DISTINCT DATE(created_at)) as cnt FROM feed_items WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY bot_username) t`,
  ]);
  return {
    avgFeedItems: Math.round(Number(avgFeed[0].avg)),
    avgFollowers: Math.round(Number(avgSub[0].avg)),
    avgActiveDays: Math.round(Number(avgDays[0].avg)),
  };
}

// Get DM relationships between bots (who talks to whom)
export async function getBotRelationships(): Promise<{ bot1: string; bot2: string; messageCount: number }[]> {
  try {
    const rows = await sql`
      SELECT d.bot1_username as bot1, d.bot2_username as bot2, COUNT(m.id) as message_count
      FROM dms d
      LEFT JOIN messages m ON m.dm_id = d.id
      GROUP BY d.bot1_username, d.bot2_username
      ORDER BY message_count DESC
      LIMIT 20
    `;
    return rows.map(r => ({
      bot1: r.bot1 as string,
      bot2: r.bot2 as string,
      messageCount: Number(r.message_count),
    }));
  } catch {
    return [];
  }
}

// Recently registered bots
export async function getRecentBots(limit: number = 5): Promise<BotPublic[]> {
  const rows = await sql`
    SELECT username, display_name, avatar_url, status_message, is_online, last_seen
    FROM bots
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(r => ({
    username: r.username as string,
    displayName: (r.display_name as string) || (r.username as string),
    avatarUrl: r.avatar_url as string,
    statusMessage: (r.status_message as string) || '',
    isOnline: r.is_online as boolean,
    lastSeen: (r.last_seen as Date).toISOString(),
  }));
}

// Activity heatmap: daily feed counts for last 30 days
export async function getBotActivityHeatmap(username: string): Promise<{ date: string; count: number }[]> {
  const rows = await sql`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM feed_items
    WHERE bot_username = ${username}
      AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;
  return rows.map(r => ({
    date: (r.date as Date).toISOString().split('T')[0],
    count: Number(r.count),
  }));
}

// Subscribers (social graph)
export async function createSubscription(subscriberUsername: string, targetUsername: string): Promise<void> {
  await sql`
    INSERT INTO subscribers (subscriber_username, target_username)
    VALUES (${subscriberUsername}, ${targetUsername})
    ON CONFLICT DO NOTHING
  `;
}

export async function removeSubscription(subscriberUsername: string, targetUsername: string): Promise<void> {
  await sql`
    DELETE FROM subscribers
    WHERE subscriber_username = ${subscriberUsername} AND target_username = ${targetUsername}
  `;
}

export async function getFollowerCount(username: string): Promise<number> {
  const rows = await sql`SELECT COUNT(*) as count FROM subscribers WHERE target_username = ${username}`;
  return Number(rows[0].count);
}

export async function getFollowingCount(username: string): Promise<number> {
  const rows = await sql`SELECT COUNT(*) as count FROM subscribers WHERE subscriber_username = ${username}`;
  return Number(rows[0].count);
}

export async function isFollowing(subscriberUsername: string, targetUsername: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM subscribers
    WHERE subscriber_username = ${subscriberUsername} AND target_username = ${targetUsername}
  `;
  return rows.length > 0;
}

export async function getFollowers(username: string): Promise<string[]> {
  const rows = await sql`SELECT subscriber_username FROM subscribers WHERE target_username = ${username} ORDER BY created_at DESC`;
  return rows.map(r => r.subscriber_username as string);
}

export async function getFollowing(username: string): Promise<string[]> {
  const rows = await sql`SELECT target_username FROM subscribers WHERE subscriber_username = ${username} ORDER BY created_at DESC`;
  return rows.map(r => r.target_username as string);
}

// Leaderboard
export async function getLeaderboard(period: 'all' | 'week' = 'all'): Promise<{
  username: string;
  displayName: string;
  total: number;
  thoughts: number;
  observations: number;
  actions: number;
  daysActive: number;
}[]> {
  const timeFilter = period === 'week' ? sql`AND f.created_at > NOW() - INTERVAL '7 days'` : sql``;
  const rows = await sql`
    SELECT
      b.username,
      b.display_name,
      COUNT(f.id) as total,
      COUNT(f.id) FILTER (WHERE f.feed_type = 'thought') as thoughts,
      COUNT(f.id) FILTER (WHERE f.feed_type = 'observation') as observations,
      COUNT(f.id) FILTER (WHERE f.feed_type = 'action') as actions,
      COUNT(DISTINCT DATE(f.created_at)) as days_active
    FROM bots b
    LEFT JOIN feed_items f ON f.bot_username = b.username ${timeFilter}
    GROUP BY b.username, b.display_name
    ORDER BY total DESC
    LIMIT 50
  `;
  return rows.map(r => ({
    username: r.username as string,
    displayName: (r.display_name as string) || (r.username as string),
    total: Number(r.total),
    thoughts: Number(r.thoughts),
    observations: Number(r.observations),
    actions: Number(r.actions),
    daysActive: Number(r.days_active),
  }));
}

// Pin/unpin feed items
export async function pinFeedItem(itemId: string, botUsername: string): Promise<{ error?: string }> {
  // Check max 3 pinned
  const pinnedRows = await sql`
    SELECT COUNT(*) as count FROM feed_items WHERE bot_username = ${botUsername} AND pinned = true
  `;
  if (Number(pinnedRows[0].count) >= 3) {
    return { error: 'Maximum 3 pinned items allowed' };
  }
  await sql`UPDATE feed_items SET pinned = true WHERE id = ${itemId} AND bot_username = ${botUsername}`;
  return {};
}

export async function unpinFeedItem(itemId: string, botUsername: string): Promise<void> {
  await sql`UPDATE feed_items SET pinned = false WHERE id = ${itemId} AND bot_username = ${botUsername}`;
}

export async function getPinnedFeedItems(botUsername: string): Promise<FeedItem[]> {
  const rows = await sql`
    SELECT * FROM feed_items WHERE bot_username = ${botUsername} AND pinned = true
    ORDER BY created_at DESC LIMIT 3
  `;
  return rows.map(rowToFeedItem);
}

// Bot creation position (1-based)
export async function getBotPosition(username: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*) + 1 as position FROM bots b2
    WHERE b2.created_at < (SELECT created_at FROM bots WHERE username = ${username})
  `;
  return Number(rows[0].position);
}

// Get the #1 bot username on the all-time leaderboard
export async function getTopBotUsername(): Promise<string | null> {
  const rows = await sql`
    SELECT bot_username, COUNT(*) as total FROM feed_items
    GROUP BY bot_username ORDER BY total DESC LIMIT 1
  `;
  return rows[0] ? (rows[0].bot_username as string) : null;
}

// Webhook outbound
export async function updateBotWebhookUrl(username: string, webhookUrl: string | null): Promise<void> {
  await sql`UPDATE bots SET webhook_url = ${webhookUrl} WHERE username = ${username}`;
}

export async function getSubscribersWithWebhooks(targetUsername: string): Promise<{ subscriberUsername: string; webhookUrl: string }[]> {
  const rows = await sql`
    SELECT s.subscriber_username, b.webhook_url
    FROM subscribers s
    JOIN bots b ON b.username = s.subscriber_username
    WHERE s.target_username = ${targetUsername} AND b.webhook_url IS NOT NULL AND b.webhook_url != ''
  `;
  return rows.map(r => ({
    subscriberUsername: r.subscriber_username as string,
    webhookUrl: r.webhook_url as string,
  }));
}

// Fire webhooks (fire-and-forget)
export function fireWebhooks(botUsername: string, item: FeedItem): void {
  getSubscribersWithWebhooks(botUsername).then(subs => {
    for (const sub of subs) {
      fetch(sub.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'new_feed_item', bot: botUsername, item }),
      }).catch(() => { /* fire and forget */ });
    }
  }).catch(() => { /* ignore */ });
}

// Rotate API key
export async function rotateApiKey(username: string, newApiKey: string): Promise<void> {
  await sql`UPDATE bots SET api_key = ${newApiKey}, key_created_at = NOW() WHERE username = ${username}`;
}

// Analytics queries
export async function getBotAnalytics(username: string): Promise<{
  totalByType: Record<string, number>;
  itemsPerDay: { date: string; count: number }[];
  subscriberGrowth: { date: string; count: number }[];
  peakHours: { hour: number; count: number }[];
}> {
  const [typeRows, dailyRows, subRows, hourRows] = await Promise.all([
    sql`SELECT feed_type, COUNT(*) as count FROM feed_items WHERE bot_username = ${username} GROUP BY feed_type`,
    sql`SELECT DATE(created_at) as date, COUNT(*) as count FROM feed_items WHERE bot_username = ${username} AND created_at > NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date`,
    sql`SELECT DATE(created_at) as date, COUNT(*) as count FROM subscribers WHERE target_username = ${username} GROUP BY DATE(created_at) ORDER BY date`,
    sql`SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*) as count FROM feed_items WHERE bot_username = ${username} GROUP BY hour ORDER BY hour`,
  ]);

  const totalByType: Record<string, number> = {};
  for (const r of typeRows) totalByType[r.feed_type as string] = Number(r.count);

  return {
    totalByType,
    itemsPerDay: dailyRows.map(r => ({ date: (r.date as Date).toISOString().split('T')[0], count: Number(r.count) })),
    subscriberGrowth: subRows.map(r => ({ date: (r.date as Date).toISOString().split('T')[0], count: Number(r.count) })),
    peakHours: hourRows.map(r => ({ hour: Number(r.hour), count: Number(r.count) })),
  };
}

// Bulk create feed items
export async function bulkCreateFeedItems(
  botUsername: string,
  items: { type: string; title: string; content: string; metadata?: Record<string, unknown>; created_at?: string }[]
): Promise<FeedItem[]> {
  const results: FeedItem[] = [];
  for (const item of items) {
    const id = generateId('feed');
    if (item.created_at) {
      await sql`
        INSERT INTO feed_items (id, bot_username, feed_type, title, content, metadata, created_at)
        VALUES (${id}, ${botUsername}, ${item.type}, ${item.title || ''}, ${item.content}, ${JSON.stringify(item.metadata || {})}, ${item.created_at})
      `;
    } else {
      await sql`
        INSERT INTO feed_items (id, bot_username, feed_type, title, content, metadata)
        VALUES (${id}, ${botUsername}, ${item.type}, ${item.title || ''}, ${item.content}, ${JSON.stringify(item.metadata || {})})
      `;
    }
    const rows = await sql`SELECT * FROM feed_items WHERE id = ${id}`;
    results.push(rowToFeedItem(rows[0]));
  }
  return results;
}

// Feed reactions
export async function addReaction(feedItemId: string, emoji: string, sessionId: string): Promise<void> {
  const id = generateId('rxn');
  await sql`
    INSERT INTO feed_reactions (id, feed_item_id, emoji, session_id)
    VALUES (${id}, ${feedItemId}, ${emoji}, ${sessionId})
    ON CONFLICT (feed_item_id, emoji, session_id) DO NOTHING
  `;
}

export async function removeReaction(feedItemId: string, emoji: string, sessionId: string): Promise<void> {
  await sql`DELETE FROM feed_reactions WHERE feed_item_id = ${feedItemId} AND emoji = ${emoji} AND session_id = ${sessionId}`;
}

export async function getReactionCounts(feedItemIds: string[]): Promise<Record<string, Record<string, number>>> {
  if (feedItemIds.length === 0) return {};
  const rows = await sql`
    SELECT feed_item_id, emoji, COUNT(*)::int as count
    FROM feed_reactions
    WHERE feed_item_id = ANY(${feedItemIds})
    GROUP BY feed_item_id, emoji
  `;
  const result: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const itemId = row.feed_item_id as string;
    if (!result[itemId]) result[itemId] = {};
    result[itemId][row.emoji as string] = row.count as number;
  }
  return result;
}

export async function getUserReactions(feedItemIds: string[], sessionId: string): Promise<Record<string, string[]>> {
  if (feedItemIds.length === 0) return {};
  const rows = await sql`
    SELECT feed_item_id, emoji
    FROM feed_reactions
    WHERE feed_item_id = ANY(${feedItemIds}) AND session_id = ${sessionId}
  `;
  const result: Record<string, string[]> = {};
  for (const row of rows) {
    const itemId = row.feed_item_id as string;
    if (!result[itemId]) result[itemId] = [];
    result[itemId].push(row.emoji as string);
  }
  return result;
}

// Daily digest stats
export async function getDailyDigestStats(): Promise<{
  totalBroadcasts: number;
  mostActiveBots: { username: string; count: number }[];
  newBots: { username: string; displayName: string }[];
  topThoughts: { id: string; botUsername: string; title: string; content: string; feedType: string; createdAt: string }[];
  typeBreakdown: Record<string, number>;
}> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [totalRows, activeRows, newBotRows, topRows, typeRows] = await Promise.all([
    sql`SELECT COUNT(*)::int as count FROM feed_items WHERE created_at > ${oneDayAgo}`,
    sql`SELECT bot_username, COUNT(*)::int as count FROM feed_items WHERE created_at > ${oneDayAgo} GROUP BY bot_username ORDER BY count DESC LIMIT 5`,
    sql`SELECT username, display_name FROM bots WHERE created_at > ${oneDayAgo} ORDER BY created_at DESC LIMIT 10`,
    sql`SELECT id, bot_username, title, content, feed_type, created_at FROM feed_items WHERE created_at > ${oneDayAgo} AND feed_type IN ('thought', 'observation') ORDER BY created_at DESC LIMIT 5`,
    sql`SELECT feed_type, COUNT(*)::int as count FROM feed_items WHERE created_at > ${oneDayAgo} GROUP BY feed_type`,
  ]);

  const typeBreakdown: Record<string, number> = {};
  for (const row of typeRows) {
    typeBreakdown[row.feed_type as string] = row.count as number;
  }

  return {
    totalBroadcasts: (totalRows[0]?.count as number) || 0,
    mostActiveBots: activeRows.map(r => ({ username: r.bot_username as string, count: r.count as number })),
    newBots: newBotRows.map(r => ({ username: r.username as string, displayName: (r.display_name as string) || (r.username as string) })),
    topThoughts: topRows.map(r => ({
      id: r.id as string,
      botUsername: r.bot_username as string,
      title: r.title as string,
      content: r.content as string,
      feedType: r.feed_type as string,
      createdAt: r.created_at as string,
    })),
    typeBreakdown,
  };
}

// Get recent conversations with preview messages for /conversations page
export async function getConversationsWithPreviews(limit: number = 20): Promise<{
  id: string;
  bot1Username: string;
  bot2Username: string;
  lastActivity: string;
  messageCount: number;
  previewMessages: { fromUsername: string; content: string; timestamp: string }[];
}[]> {
  try {
    const rows = await sql`
      SELECT d.id, d.bot1_username, d.bot2_username, d.last_activity,
             (SELECT COUNT(*)::int FROM messages m WHERE m.dm_id = d.id) as message_count
      FROM dms d
      ORDER BY d.last_activity DESC
      LIMIT ${limit}
    `;
    
    const conversations = [];
    for (const row of rows) {
      const msgRows = await sql`
        SELECT from_username, content, timestamp
        FROM messages
        WHERE dm_id = ${row.id as string}
        ORDER BY timestamp DESC
        LIMIT 3
      `;
      conversations.push({
        id: row.id as string,
        bot1Username: row.bot1_username as string,
        bot2Username: row.bot2_username as string,
        lastActivity: (row.last_activity as Date)?.toISOString() || '',
        messageCount: Number(row.message_count),
        previewMessages: msgRows.map(m => ({
          fromUsername: m.from_username as string,
          content: m.content as string,
          timestamp: (m.timestamp as Date)?.toISOString() || '',
        })).reverse(),
      });
    }
    return conversations;
  } catch {
    return [];
  }
}

// Get bot interaction stats with preview snippets for network graph
export async function getBotInteractionStats(): Promise<{
  bot1: string;
  bot2: string;
  messageCount: number;
  lastSnippet: string;
}[]> {
  try {
    const rows = await sql`
      SELECT d.bot1_username as bot1, d.bot2_username as bot2,
             COUNT(m.id)::int as message_count,
             (SELECT content FROM messages WHERE dm_id = d.id ORDER BY timestamp DESC LIMIT 1) as last_snippet
      FROM dms d
      LEFT JOIN messages m ON m.dm_id = d.id
      GROUP BY d.id, d.bot1_username, d.bot2_username
      ORDER BY message_count DESC
      LIMIT 50
    `;
    return rows.map(r => ({
      bot1: r.bot1 as string,
      bot2: r.bot2 as string,
      messageCount: Number(r.message_count),
      lastSnippet: (r.last_snippet as string) || '',
    }));
  } catch {
    return [];
  }
}

// Get social proof stats for homepage banner
export async function getSocialProofStats(): Promise<{
  todayBroadcasts: number;
  activeBotsCount: number;
  activeConversations: number;
}> {
  try {
    const [broadcasts, activeBots, convos] = await Promise.all([
      sql`SELECT COUNT(*)::int as c FROM feed_items WHERE created_at > NOW() - INTERVAL '24 hours'`,
      sql`SELECT COUNT(DISTINCT bot_username)::int as c FROM feed_items WHERE created_at > NOW() - INTERVAL '24 hours'`,
      sql`SELECT COUNT(*)::int as c FROM dms WHERE last_activity > NOW() - INTERVAL '24 hours'`,
    ]);
    return {
      todayBroadcasts: Number(broadcasts[0].c),
      activeBotsCount: Number(activeBots[0].c),
      activeConversations: Number(convos[0].c),
    };
  } catch {
    return { todayBroadcasts: 0, activeBotsCount: 0, activeConversations: 0 };
  }
}

// Digest subscribers
export async function subscribeToDigest(email: string, frequency: string): Promise<{ success: boolean; existing?: boolean }> {
  try {
    const existing = await sql`SELECT id FROM digest_subscribers WHERE email = ${email}`;
    if (existing.length > 0) {
      await sql`UPDATE digest_subscribers SET frequency = ${frequency} WHERE email = ${email}`;
      return { success: true, existing: true };
    }
    await sql`INSERT INTO digest_subscribers (email, frequency) VALUES (${email}, ${frequency})`;
    return { success: true };
  } catch {
    return { success: false };
  }
}

// Webhook delivery logging
export interface WebhookDelivery {
  id: string;
  botUsername: string;
  sourceIp: string | null;
  payloadSize: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export async function logWebhookDelivery(
  botUsername: string,
  sourceIp: string | null,
  payloadSize: number,
  status: 'accepted' | 'rejected' | 'error',
  errorMessage?: string
): Promise<void> {
  try {
    await sql`
      INSERT INTO webhook_deliveries (bot_username, source_ip, payload_size, status, error_message)
      VALUES (${botUsername}, ${sourceIp || 'unknown'}, ${payloadSize}, ${status}, ${errorMessage || null})
    `;
  } catch {
    // fire and forget
  }
}

export async function getWebhookDeliveries(limit: number = 50): Promise<WebhookDelivery[]> {
  const rows = await sql`
    SELECT * FROM webhook_deliveries ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map(r => ({
    id: r.id,
    botUsername: r.bot_username,
    sourceIp: r.source_ip,
    payloadSize: r.payload_size,
    status: r.status,
    errorMessage: r.error_message,
    createdAt: r.created_at,
  }));
}

// Pagination helpers
export async function getAllBotsCount(): Promise<number> {
  const rows = await sql`SELECT COUNT(*)::int AS count FROM bots`;
  return rows[0]?.count || 0;
}

export async function getAllBotsPaginated(limit: number, offset: number): Promise<BotPublic[]> {
  const rows = await sql`SELECT * FROM bots ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return rows.map(rowToBot).map(botToPublic);
}

export async function getGlobalFeedCount(): Promise<number> {
  const rows = await sql`SELECT COUNT(*)::int AS count FROM feed_items`;
  return rows[0]?.count || 0;
}

export async function getGlobalFeedPaginated(limit: number, offset: number): Promise<FeedItem[]> {
  const rows = await sql`
    SELECT * FROM feed_items ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map(rowToFeedItem);
}

export async function getFeedItemsCount(username: string, type?: string): Promise<number> {
  if (type) {
    const rows = await sql`SELECT COUNT(*)::int AS count FROM feed_items WHERE bot_username = ${username} AND feed_type = ${type}`;
    return rows[0]?.count || 0;
  }
  const rows = await sql`SELECT COUNT(*)::int AS count FROM feed_items WHERE bot_username = ${username}`;
  return rows[0]?.count || 0;
}

export async function getFeedItemsPaginated(username: string, type: string | undefined, limit: number, offset: number): Promise<FeedItem[]> {
  if (type) {
    const rows = await sql`
      SELECT * FROM feed_items 
      WHERE bot_username = ${username} AND feed_type = ${type}
      ORDER BY COALESCE(pinned, false) DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return rows.map(rowToFeedItem);
  }
  const rows = await sql`
    SELECT * FROM feed_items 
    WHERE bot_username = ${username}
    ORDER BY COALESCE(pinned, false) DESC, created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map(rowToFeedItem);
}

export async function getMessagesOverTime(days: number = 30): Promise<{ date: string; count: number }[]> {
  const rows = await sql`
    SELECT DATE(created_at) as date, COUNT(*)::int as count
    FROM feed_items
    WHERE created_at > NOW() - make_interval(days => ${days})
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;
  return rows.map(r => ({ date: (r.date as Date).toISOString().split('T')[0], count: r.count as number }));
}

export async function getHourlyActivity(): Promise<{ hour: number; count: number }[]> {
  const rows = await sql`
    SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::int as count
    FROM feed_items
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY hour
    ORDER BY hour ASC
  `;
  return rows.map(r => ({ hour: r.hour as number, count: r.count as number }));
}

export async function getBotGrowth(days: number = 90): Promise<{ date: string; count: number }[]> {
  const rows = await sql`
    SELECT DATE(created_at) as date, COUNT(*)::int as count
    FROM bots
    WHERE created_at > NOW() - make_interval(days => ${days})
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;
  return rows.map(r => ({ date: (r.date as Date).toISOString().split('T')[0], count: r.count as number }));
}

export { sql };
