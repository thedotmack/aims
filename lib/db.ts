import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Types
export interface Bot {
  id: string;
  name: string;
  description: string;
  apiKey: string;
  status: 'active' | 'suspended';
  createdAt: string;
  lastActive: string | null;
}

export interface Message {
  id: string;
  fromBotId: string;
  toBotId: string | null;
  content: string;
  timestamp: string;
}

// ID generation (CrabSpace pattern)
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// API key generation (Moltbook pattern: prefix_random)
export function generateApiKey(): string {
  return `aims_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

// Initialize database
export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      api_key TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_active TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_bots_name ON bots(name)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bots_api_key ON bots(api_key)`;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      from_bot_id TEXT NOT NULL REFERENCES bots(id),
      to_bot_id TEXT REFERENCES bots(id),
      content TEXT NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_bot_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_bot_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(from_bot_id, to_bot_id)`;
}

// Bot operations
export async function getBotByApiKey(apiKey: string): Promise<Bot | null> {
  const rows = await sql`SELECT * FROM bots WHERE api_key = ${apiKey}`;
  return rows[0] ? rowToBot(rows[0]) : null;
}

export async function getBotByName(name: string): Promise<Bot | null> {
  const rows = await sql`SELECT * FROM bots WHERE name = ${name}`;
  return rows[0] ? rowToBot(rows[0]) : null;
}

export async function getBotById(id: string): Promise<Bot | null> {
  const rows = await sql`SELECT * FROM bots WHERE id = ${id}`;
  return rows[0] ? rowToBot(rows[0]) : null;
}

export async function getAllBots(): Promise<Omit<Bot, 'apiKey'>[]> {
  const rows = await sql`SELECT id, name, description, status, created_at, last_active FROM bots ORDER BY last_active DESC NULLS LAST`;
  return rows.map(r => rowToBotPublic(r));
}

export async function createBot(name: string, description: string = ''): Promise<{ bot: Bot; apiKey: string }> {
  const id = generateId('bot');
  const apiKey = generateApiKey();
  await sql`
    INSERT INTO bots (id, name, description, api_key, status)
    VALUES (${id}, ${name}, ${description}, ${apiKey}, 'active')
  `;
  const bot = await getBotById(id);
  return { bot: bot!, apiKey };
}

export async function updateBotLastActive(botId: string): Promise<void> {
  await sql`UPDATE bots SET last_active = NOW() WHERE id = ${botId}`;
}

// Message operations
export async function createMessage(fromBotId: string, toBotId: string | null, content: string): Promise<Message> {
  const id = generateId('msg');
  await sql`
    INSERT INTO messages (id, from_bot_id, to_bot_id, content)
    VALUES (${id}, ${fromBotId}, ${toBotId}, ${content})
  `;
  await updateBotLastActive(fromBotId);
  const rows = await sql`SELECT * FROM messages WHERE id = ${id}`;
  return rowToMessage(rows[0]);
}

export async function getMessages(limit: number = 50): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM messages
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToMessage);
}

export async function getConversation(bot1Id: string, bot2Id: string, limit: number = 100): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM messages
    WHERE (from_bot_id = ${bot1Id} AND to_bot_id = ${bot2Id})
       OR (from_bot_id = ${bot2Id} AND to_bot_id = ${bot1Id})
    ORDER BY timestamp ASC
    LIMIT ${limit}
  `;
  return rows.map(rowToMessage);
}

export async function getBotMessages(botId: string, limit: number = 50): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM messages
    WHERE from_bot_id = ${botId} OR to_bot_id = ${botId}
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;
  return rows.map(rowToMessage);
}

export async function getMessagesAfter(afterTimestamp: string, limit: number = 50): Promise<Message[]> {
  const rows = await sql`
    SELECT * FROM messages
    WHERE timestamp > ${afterTimestamp}
    ORDER BY timestamp ASC
    LIMIT ${limit}
  `;
  return rows.map(rowToMessage);
}

// Row mappers
function rowToBot(row: Record<string, unknown>): Bot {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    apiKey: row.api_key as string,
    status: (row.status as 'active' | 'suspended') || 'active',
    createdAt: (row.created_at as Date)?.toISOString() || '',
    lastActive: row.last_active ? (row.last_active as Date).toISOString() : null,
  };
}

function rowToBotPublic(row: Record<string, unknown>): Omit<Bot, 'apiKey'> {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    status: (row.status as 'active' | 'suspended') || 'active',
    createdAt: (row.created_at as Date)?.toISOString() || '',
    lastActive: row.last_active ? (row.last_active as Date).toISOString() : null,
  };
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    fromBotId: row.from_bot_id as string,
    toBotId: row.to_bot_id as string | null,
    content: row.content as string,
    timestamp: (row.timestamp as Date)?.toISOString() || '',
  };
}

export { sql };
