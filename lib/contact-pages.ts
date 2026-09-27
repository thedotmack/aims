import { timingSafeEqual as cryptoTimingSafeEqual } from 'crypto';
import { sql, generateId, ensureContactTables } from './db';
import { hashSecret, looksLikePlainOwnerToken, randomToken, verifyStoredSecret } from './crypto-tokens';
import { pinnedFetch, resolveAndPinPublicUrl } from './ssrf';
import { signStandardWebhook, toStandardWebhookSecret } from './standard-webhooks';
import { getBindingForPage } from './discord-store';

export const LINKTREE_VERSION = '2026-09-23b';

export interface ContactPage {
  id: string;
  slug: string;
  ownerToken: string;
  name: string;
  bio: string;
  avatarUrl: string;
  webhookUrl: string | null;
  webhookSecret: string | null;
  imessage: string;
  whatsapp: string;
  telegram: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicContactPage {
  slug: string;
  name: string;
  bio: string;
  avatarUrl: string;
  contacts: ContactOption[];
  bot2bot: boolean;
  urls: {
    page: string;
    contact: string;
    message: string;
  };
}

export interface ContactOption {
  id: 'imessage' | 'whatsapp' | 'telegram' | 'cli' | 'discord';
  label: string;
  href: string;
  available: boolean;
  kind: 'deeplink' | 'api';
}

export interface DiscordWakeMeta {
  guildId: string;
  channelId: string;
  threadId: string | null;
  sourceMessageId: string;
  handle: string;
  hop: number;
}

export interface ContactMessage {
  id: string;
  pageId: string;
  fromName: string;
  replyTo: string | null;
  content: string;
  delivered: boolean;
  deliveryStatus: string;
  webhookStatus: number | null;
  ack: string | null;
  createdAt: string;
  source?: 'api' | 'discord';
  hop?: number;
  discord?: DiscordWakeMeta | null;
  replyTokenHash?: string | null;
  replyExpiresAt?: string | null;
  replyCount?: number;
}

export interface CreatePageInput {
  name: string;
  bio?: string;
  avatarUrl?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  imessage?: string;
  whatsapp?: string;
  telegram?: string;
}

export interface UpdatePageInput {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
  imessage?: string;
  whatsapp?: string;
  telegram?: string;
}

const WEBHOOK_TIMEOUT_MS = 8_000;
const MAX_INBOX = 25;

function token(prefix: string, bytes: number): string {
  return randomToken(prefix, bytes);
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function rowToPage(row: Record<string, unknown>): ContactPage {
  return {
    id: String(row.id),
    slug: String(row.slug),
    ownerToken: String(row.owner_token),
    name: String(row.name ?? ''),
    bio: String(row.bio ?? ''),
    avatarUrl: String(row.avatar_url ?? ''),
    webhookUrl: (row.webhook_url as string) || null,
    webhookSecret: (row.webhook_secret as string) || null,
    imessage: String(row.imessage ?? ''),
    whatsapp: String(row.whatsapp ?? ''),
    telegram: String(row.telegram ?? ''),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export function siteOrigin(): string {
  return process.env.AIMS_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://aims.bot';
}

export function originFromRequest(request: Request): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return siteOrigin();
  const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export function normalizePhone(value: string): string {
  return value.replace(/[^\d]/g, '');
}

export function isSafeWebhookUrl(raw: string, opts?: { allowHttpLocal?: boolean }): { ok: true; url: string } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: 'webhookUrl must be a valid URL' };
  }

  const host = parsed.hostname.toLowerCase();
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]';

  if (isLocal) {
    if (!opts?.allowHttpLocal) {
      return { ok: false, error: 'localhost webhooks are not allowed' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: 'webhookUrl must use http or https' };
    }
    return { ok: true, url: parsed.toString() };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'webhookUrl must use https (http is only allowed for localhost)' };
  }

  if (
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    host === 'metadata.google.internal' ||
    (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateIpv4(host))
  ) {
    return { ok: false, error: 'webhookUrl cannot point at a private or internal host' };
  }

  return { ok: true, url: parsed.toString() };
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 0 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function buildContactOptions(
  page: Pick<ContactPage, 'slug' | 'imessage' | 'whatsapp' | 'telegram' | 'webhookUrl'>,
  extras?: { discord?: { href: string } | null }
): ContactOption[] {
  const options: ContactOption[] = [];

  if (page.imessage.trim()) {
    const raw = page.imessage.trim();
    const href = raw.includes('@')
      ? `imessage:${encodeURIComponent(raw)}`
      : `sms:+${normalizePhone(raw)}`;
    options.push({ id: 'imessage', label: 'iMessage', href, available: true, kind: 'deeplink' });
  }

  if (page.whatsapp.trim()) {
    const phone = normalizePhone(page.whatsapp);
    options.push({
      id: 'whatsapp',
      label: 'WhatsApp',
      href: `https://wa.me/${phone}`,
      available: true,
      kind: 'deeplink',
    });
  }

  if (page.telegram.trim()) {
    const username = page.telegram.trim().replace(/^@/, '');
    options.push({
      id: 'telegram',
      label: 'Telegram',
      href: `https://t.me/${encodeURIComponent(username)}`,
      available: true,
      kind: 'deeplink',
    });
  }

  if (extras?.discord?.href) {
    options.push({
      id: 'discord',
      label: 'Discord',
      href: extras.discord.href,
      available: true,
      kind: 'deeplink',
    });
  }

  options.push({
    id: 'cli',
    label: 'CLI / bot2bot',
    href: `/api/v1/pages/${page.slug}/message`,
    available: Boolean(page.webhookUrl),
    kind: 'api',
  });

  return options;
}

export function toPublicPage(
  page: ContactPage,
  origin = siteOrigin(),
  extras?: { discord?: { href: string } | null }
): PublicContactPage {
  return {
    slug: page.slug,
    name: page.name,
    bio: page.bio,
    avatarUrl: page.avatarUrl,
    contacts: buildContactOptions(page, extras),
    bot2bot: Boolean(page.webhookUrl),
    urls: {
      page: `${origin}/p/${page.slug}`,
      contact: `${origin}/api/v1/pages/${page.slug}/contact`,
      message: `${origin}/api/v1/pages/${page.slug}/message`,
    },
  };
}

export async function toPublicPageWithBindings(page: ContactPage, origin = siteOrigin()): Promise<PublicContactPage> {
  const binding = await getBindingForPage(page.id).catch(() => null);
  const discord = binding
    ? { href: `https://discord.com/channels/${binding.guildId}/${binding.channelId}` }
    : null;
  return toPublicPage(page, origin, { discord });
}

export function publicPageJson(page: ContactPage, origin = siteOrigin()) {
  return {
    success: true,
    page: toPublicPage(page, origin),
  };
}

export async function createContactPage(input: CreatePageInput): Promise<ContactPage> {
  await ensureContactTables();
  const id = generateId('pg');
  const slug = token('', 9);
  const ownerToken = token('own_', 18);
  const ownerTokenHash = hashSecret(ownerToken);
  const rows = await sql`
    INSERT INTO contact_pages (
      id, slug, owner_token, name, bio, avatar_url,
      webhook_url, webhook_secret, imessage, whatsapp, telegram
    ) VALUES (
      ${id}, ${slug}, ${ownerTokenHash}, ${input.name}, ${input.bio || ''}, ${input.avatarUrl || ''},
      ${input.webhookUrl || null}, ${input.webhookSecret || null},
      ${input.imessage || ''}, ${input.whatsapp || ''}, ${input.telegram || ''}
    )
    RETURNING *
  `;
  return { ...rowToPage(rows[0] as Record<string, unknown>), ownerToken };
}

async function migratePlainOwnerToken(page: ContactPage): Promise<ContactPage> {
  if (!looksLikePlainOwnerToken(page.ownerToken)) return page;
  const hashed = hashSecret(page.ownerToken);
  await sql`
    UPDATE contact_pages
    SET owner_token = ${hashed}
    WHERE id = ${page.id} AND owner_token = ${page.ownerToken}
  `;
  return { ...page, ownerToken: hashed };
}

export async function getPageBySlug(slug: string): Promise<ContactPage | null> {
  await ensureContactTables();
  const rows = await sql`SELECT * FROM contact_pages WHERE slug = ${slug} LIMIT 1`;
  if (!rows[0]) return null;
  return migratePlainOwnerToken(rowToPage(rows[0] as Record<string, unknown>));
}

export async function getPageByOwnerToken(tokenValue: string): Promise<ContactPage | null> {
  await ensureContactTables();
  const hashed = hashSecret(tokenValue);
  const rows = await sql`
    SELECT * FROM contact_pages
    WHERE owner_token = ${hashed} OR owner_token = ${tokenValue}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return migratePlainOwnerToken(rowToPage(rows[0] as Record<string, unknown>));
}

export function verifyOwnerToken(page: ContactPage, provided: string): boolean {
  return verifyStoredSecret(page.ownerToken, provided);
}

export async function getPageById(id: string): Promise<ContactPage | null> {
  await ensureContactTables();
  const rows = await sql`SELECT * FROM contact_pages WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  return migratePlainOwnerToken(rowToPage(rows[0] as Record<string, unknown>));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return cryptoTimingSafeEqual(left, right);
}

export async function updateContactPage(slug: string, ownerToken: string, input: UpdatePageInput): Promise<ContactPage | null> {
  const page = await getPageBySlug(slug);
  if (!page || !verifyOwnerToken(page, ownerToken)) return null;

  const name = input.name ?? page.name;
  const bio = input.bio ?? page.bio;
  const avatarUrl = input.avatarUrl ?? page.avatarUrl;
  const webhookUrl = input.webhookUrl === undefined ? page.webhookUrl : input.webhookUrl;
  const webhookSecret = input.webhookSecret === undefined ? page.webhookSecret : input.webhookSecret;
  const imessage = input.imessage ?? page.imessage;
  const whatsapp = input.whatsapp ?? page.whatsapp;
  const telegram = input.telegram ?? page.telegram;

  const rows = await sql`
    UPDATE contact_pages SET
      name = ${name},
      bio = ${bio},
      avatar_url = ${avatarUrl},
      webhook_url = ${webhookUrl},
      webhook_secret = ${webhookSecret},
      imessage = ${imessage},
      whatsapp = ${whatsapp},
      telegram = ${telegram},
      updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING *
  `;
  return rows[0] ? rowToPage(rows[0] as Record<string, unknown>) : null;
}

export async function createContactMessage(
  page: ContactPage,
  input: {
    fromName: string;
    content: string;
    replyTo?: string | null;
    source?: 'api' | 'discord';
    hop?: number;
    discord?: DiscordWakeMeta | null;
  }
): Promise<ContactMessage> {
  await ensureContactTables();
  const id = generateId('cmsg');
  const source = input.source || 'api';
  const hop = input.hop ?? 0;
  const discord = input.discord || null;
  const rows = await sql`
    INSERT INTO contact_messages (
      id, page_id, from_name, reply_to, content, source, hop,
      discord_guild_id, discord_channel_id, discord_thread_id, discord_source_message_id
    )
    VALUES (
      ${id}, ${page.id}, ${input.fromName}, ${input.replyTo || null}, ${input.content},
      ${source}, ${hop},
      ${discord?.guildId || null}, ${discord?.channelId || null},
      ${discord?.threadId || null}, ${discord?.sourceMessageId || null}
    )
    RETURNING *
  `;
  return rowToMessage(rows[0] as Record<string, unknown>, discord);
}

function rowToMessage(row: Record<string, unknown>, discordHint?: DiscordWakeMeta | null): ContactMessage {
  const discord = discordHint || (row.discord_guild_id
    ? {
        guildId: String(row.discord_guild_id),
        channelId: String(row.discord_channel_id || ''),
        threadId: (row.discord_thread_id as string) || null,
        sourceMessageId: String(row.discord_source_message_id || ''),
        handle: '',
        hop: Number(row.hop ?? 0),
      }
    : null);
  return {
    id: String(row.id),
    pageId: String(row.page_id),
    fromName: String(row.from_name ?? ''),
    replyTo: (row.reply_to as string) || null,
    content: String(row.content ?? ''),
    delivered: Boolean(row.delivered),
    deliveryStatus: String(row.delivery_status ?? 'pending'),
    webhookStatus: row.webhook_status == null ? null : Number(row.webhook_status),
    ack: (row.ack as string) || null,
    createdAt: asIso(row.created_at),
    source: (row.source as 'api' | 'discord') || 'api',
    hop: Number(row.hop ?? 0),
    discord,
    replyTokenHash: (row.reply_token_hash as string) || null,
    replyExpiresAt: row.reply_expires_at ? asIso(row.reply_expires_at) : null,
    replyCount: Number(row.reply_count ?? 0),
  };
}

export async function markMessageDelivery(
  id: string,
  update: { delivered: boolean; deliveryStatus: string; webhookStatus: number | null; ack: string | null }
): Promise<ContactMessage | null> {
  const rows = await sql`
    UPDATE contact_messages SET
      delivered = ${update.delivered},
      delivery_status = ${update.deliveryStatus},
      webhook_status = ${update.webhookStatus},
      ack = ${update.ack}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? rowToMessage(rows[0] as Record<string, unknown>) : null;
}

export interface WebhookDeliveryResult {
  delivered: boolean;
  statusCode: number | null;
  ack: string | null;
  error: string | null;
}

export interface OwnerWakeExtras {
  discord?: DiscordWakeMeta;
  reply?: { url: string; token: string; expiresAt: string };
}

export function ownerWebhookPayload(page: ContactPage, message: ContactMessage, extras?: OwnerWakeExtras) {
  const payload: Record<string, unknown> = {
    event: 'contact.message',
    version: 1,
    page: { slug: page.slug, name: page.name },
    message: {
      id: message.id,
      from: message.fromName,
      content: message.content,
      replyTo: extras?.reply?.url ?? message.replyTo,
      createdAt: message.createdAt,
    },
  };
  if (extras?.discord) {
    payload.discord = {
      guildId: extras.discord.guildId,
      channelId: extras.discord.channelId,
      threadId: extras.discord.threadId,
      sourceMessageId: extras.discord.sourceMessageId,
      handle: extras.discord.handle,
      hop: extras.discord.hop,
    };
  }
  if (extras?.reply) {
    payload.reply = {
      url: extras.reply.url,
      token: extras.reply.token,
      expiresAt: extras.reply.expiresAt,
    };
  }
  return payload;
}

export function connectReadyPayload(
  page: Pick<ContactPage, 'slug' | 'name'>,
  discord: { guildId: string; channelId: string; handle: string }
) {
  return {
    event: 'connect.ready',
    version: 1,
    page: { slug: page.slug, name: page.name },
    discord: {
      connected: true,
      guildId: discord.guildId,
      channelId: discord.channelId,
      handle: discord.handle,
      mention: `@aims ${discord.handle}`,
    },
  };
}

function parseAckBody(text: string): string | null {
  let ack: string | null = null;
  try {
    const json = JSON.parse(text) as { ack?: unknown; message?: unknown };
    if (typeof json.ack === 'string') ack = json.ack;
    else if (typeof json.message === 'string') ack = json.message;
  } catch {
    if (text && text.length > 0 && text.length < 400) ack = text.trim();
  }
  return ack;
}

async function postOwnerWebhook(
  page: ContactPage,
  event: string,
  payload: unknown
): Promise<WebhookDeliveryResult> {
  if (!page.webhookUrl) {
    return { delivered: false, statusCode: null, ack: null, error: 'no_webhook' };
  }

  const pin = await resolveAndPinPublicUrl(page.webhookUrl);
  if (!pin.ok) {
    return { delivered: false, statusCode: null, ack: null, error: pin.error };
  }

  const raw = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'aims.bot-linktree/1.0',
    'X-Aims-Event': event,
  };
  if (page.webhookSecret) {
    headers['X-Aims-Secret'] = page.webhookSecret;
  }
  const swSecret = toStandardWebhookSecret(page.webhookSecret || `aims-${page.id}`);
  Object.assign(headers, signStandardWebhook(swSecret, raw));

  const init: RequestInit = {
    method: 'POST',
    headers,
    body: raw,
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    redirect: 'error',
  };

  try {
    const res = process.env.VITEST
      ? await fetch(page.webhookUrl, init)
      : await pinnedFetch(page.webhookUrl, init, pin.pin);

    const text = (await res.text()).slice(0, 65_536);
    return {
      delivered: res.ok,
      statusCode: res.status,
      ack: parseAckBody(text),
      error: res.ok ? null : `webhook_http_${res.status}`,
    };
  } catch {
    return { delivered: false, statusCode: null, ack: null, error: 'webhook_unreachable' };
  }
}

export async function deliverOwnerWebhook(
  page: ContactPage,
  message: ContactMessage,
  extras?: OwnerWakeExtras
): Promise<WebhookDeliveryResult> {
  return postOwnerWebhook(page, 'contact.message', ownerWebhookPayload(page, message, extras));
}

export async function deliverConnectReady(
  page: ContactPage,
  discord: { guildId: string; channelId: string; handle: string }
): Promise<WebhookDeliveryResult> {
  return postOwnerWebhook(page, 'connect.ready', connectReadyPayload(page, discord));
}

export async function createInbox(origin = siteOrigin()): Promise<{ token: string; url: string }> {
  await ensureContactTables();
  const inboxToken = token('inbox_', 16);
  await sql`INSERT INTO webhook_inbox (token, payloads) VALUES (${inboxToken}, ${'[]'})`;
  return { token: inboxToken, url: `${origin}/api/v1/inbox/${inboxToken}` };
}

export async function appendInboxPayload(inboxToken: string, payload: unknown): Promise<{ count: number }> {
  await ensureContactTables();
  const rows = await sql`SELECT payloads FROM webhook_inbox WHERE token = ${inboxToken} LIMIT 1`;
  const incoming = {
    receivedAt: new Date().toISOString(),
    payload,
  };

  if (!rows[0]) {
    await sql`INSERT INTO webhook_inbox (token, payloads) VALUES (${inboxToken}, ${JSON.stringify([incoming])})`;
    return { count: 1 };
  }

  let list: unknown[] = [];
  try {
    const raw = rows[0].payloads;
    list = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
  } catch {
    list = [];
  }
  if (!Array.isArray(list)) list = [];
  list.push(incoming);
  const trimmed = list.slice(-MAX_INBOX);
  await sql`
    UPDATE webhook_inbox
    SET payloads = ${JSON.stringify(trimmed)}, updated_at = NOW()
    WHERE token = ${inboxToken}
  `;
  return { count: trimmed.length };
}

export async function getInbox(inboxToken: string): Promise<{ token: string; payloads: unknown[] } | null> {
  await ensureContactTables();
  const rows = await sql`SELECT token, payloads FROM webhook_inbox WHERE token = ${inboxToken} LIMIT 1`;
  if (!rows[0]) return null;
  let payloads: unknown[] = [];
  try {
    const raw = rows[0].payloads;
    payloads = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
  } catch {
    payloads = [];
  }
  return { token: String(rows[0].token), payloads };
}

export function extractOwnerToken(request: Request, body?: Record<string, unknown>): string | null {
  const header = request.headers.get('x-owner-token') || request.headers.get('authorization');
  if (header) {
    const raw = header.startsWith('Bearer ') ? header.slice(7) : header;
    if (raw) return raw;
  }
  const url = new URL(request.url);
  const query = url.searchParams.get('token') || url.searchParams.get('ownerToken');
  if (query) return query;
  if (body && typeof body.ownerToken === 'string') return body.ownerToken;
  return null;
}
