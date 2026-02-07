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
  await sql`DROP TABLE IF EXISTS bots CASCADE`;
  
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
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)`;
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
export async function createMessage(chatId: string, username: string, content: string): Promise<Message> {
  const id = generateId('msg');
  await sql`
    INSERT INTO messages (id, chat_id, username, content)
    VALUES (${id}, ${chatId}, ${username}, ${content})
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
  };
}

export { sql };
