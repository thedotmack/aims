import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

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

// Initialize database
export async function initDB() {
  // Drop old tables if they exist (clean slate)
  await sql`DROP TABLE IF EXISTS messages CASCADE`;
  
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
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      is_bot BOOLEAN DEFAULT FALSE,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)`;
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
      matrix_id TEXT UNIQUE NOT NULL,
      display_name TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      status_message TEXT DEFAULT '',
      is_online BOOLEAN DEFAULT FALSE,
      access_token TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_bots_username ON bots(username)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bots_matrix_id ON bots(matrix_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS dms (
      id TEXT PRIMARY KEY,
      room_id TEXT UNIQUE NOT NULL,
      bot1_username TEXT NOT NULL,
      bot2_username TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_activity TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_dms_room ON dms(room_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dms_bot1 ON dms(bot1_username)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dms_bot2 ON dms(bot2_username)`;
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

// Message operations
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
  matrixId: string;
  displayName: string;
  avatarUrl: string;
  statusMessage: string;
  isOnline: boolean;
  accessToken: string;
  password: string;
  createdAt: string;
  lastSeen: string;
}

export interface BotPublic {
  username: string;
  matrixId: string;
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
    matrixId: row.matrix_id as string,
    displayName: (row.display_name as string) || '',
    avatarUrl: (row.avatar_url as string) || '',
    statusMessage: (row.status_message as string) || '',
    isOnline: (row.is_online as boolean) || false,
    accessToken: row.access_token as string,
    password: row.password as string,
    createdAt: (row.created_at as Date)?.toISOString() || '',
    lastSeen: (row.last_seen as Date)?.toISOString() || '',
  };
}

function botToPublic(bot: Bot): BotPublic {
  return {
    username: bot.username,
    matrixId: bot.matrixId,
    displayName: bot.displayName,
    avatarUrl: bot.avatarUrl,
    statusMessage: bot.statusMessage,
    isOnline: bot.isOnline,
    lastSeen: bot.lastSeen,
  };
}

export async function createBot(
  username: string,
  matrixId: string,
  displayName: string,
  accessToken: string,
  password: string
): Promise<Bot> {
  const id = generateId('bot');
  await sql`
    INSERT INTO bots (id, username, matrix_id, display_name, access_token, password)
    VALUES (${id}, ${username}, ${matrixId}, ${displayName}, ${accessToken}, ${password})
  `;
  const rows = await sql`SELECT * FROM bots WHERE id = ${id}`;
  return rowToBot(rows[0]);
}

export async function getBotByUsername(username: string): Promise<Bot | null> {
  const rows = await sql`SELECT * FROM bots WHERE username = ${username}`;
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
  roomId: string;
  bot1Username: string;
  bot2Username: string;
  createdAt: string;
  lastActivity: string;
}

function rowToDM(row: Record<string, unknown>): DM {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    bot1Username: row.bot1_username as string,
    bot2Username: row.bot2_username as string,
    createdAt: (row.created_at as Date)?.toISOString() || '',
    lastActivity: (row.last_activity as Date)?.toISOString() || '',
  };
}

export async function createDM(roomId: string, bot1Username: string, bot2Username: string): Promise<DM> {
  const id = generateId('dm');
  await sql`
    INSERT INTO dms (id, room_id, bot1_username, bot2_username)
    VALUES (${id}, ${roomId}, ${bot1Username}, ${bot2Username})
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

export async function getDMByRoomId(roomId: string): Promise<DM | null> {
  const rows = await sql`SELECT * FROM dms WHERE room_id = ${roomId}`;
  return rows[0] ? rowToDM(rows[0]) : null;
}

export async function updateDMActivity(roomId: string): Promise<void> {
  await sql`UPDATE dms SET last_activity = NOW() WHERE room_id = ${roomId}`;
}

export { sql };
