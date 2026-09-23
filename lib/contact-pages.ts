import { randomBytes, timingSafeEqual as cryptoTimingSafeEqual } from 'crypto';
import { sql, generateId, ensureContactTables } from './db';

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
  id: 'imessage' | 'whatsapp' | 'telegram' | 'cli';
  label: string;
  href: string;
  available: boolean;
  kind: 'deeplink' | 'api';
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
  return prefix + randomBytes(bytes).toString('hex');
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

export function buildContactOptions(page: Pick<ContactPage, 'slug' | 'imessage' | 'whatsapp' | 'telegram' | 'webhookUrl'>): ContactOption[] {
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

  options.push({
    id: 'cli',
    label: 'CLI / bot2bot',
    href: `/api/v1/pages/${page.slug}/message`,
    available: Boolean(page.webhookUrl),
    kind: 'api',
  });

  return options;
}

export function toPublicPage(page: ContactPage, origin = siteOrigin()): PublicContactPage {
  return {
    slug: page.slug,
    name: page.name,
    bio: page.bio,
    avatarUrl: page.avatarUrl,
    contacts: buildContactOptions(page),
    bot2bot: Boolean(page.webhookUrl),
    urls: {
      page: `${origin}/p/${page.slug}`,
      contact: `${origin}/api/v1/pages/${page.slug}/contact`,
      message: `${origin}/api/v1/pages/${page.slug}/message`,
    },
  };
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
  const rows = await sql`
    INSERT INTO contact_pages (
      id, slug, owner_token, name, bio, avatar_url,
      webhook_url, webhook_secret, imessage, whatsapp, telegram
    ) VALUES (
      ${id}, ${slug}, ${ownerToken}, ${input.name}, ${input.bio || ''}, ${input.avatarUrl || ''},
      ${input.webhookUrl || null}, ${input.webhookSecret || null},
      ${input.imessage || ''}, ${input.whatsapp || ''}, ${input.telegram || ''}
    )
    RETURNING *
  `;
  return rowToPage(rows[0] as Record<string, unknown>);
}

export async function getPageBySlug(slug: string): Promise<ContactPage | null> {
  await ensureContactTables();
  const rows = await sql`SELECT * FROM contact_pages WHERE slug = ${slug} LIMIT 1`;
  return rows[0] ? rowToPage(rows[0] as Record<string, unknown>) : null;
}

export async function getPageByOwnerToken(tokenValue: string): Promise<ContactPage | null> {
  await ensureContactTables();
  const rows = await sql`SELECT * FROM contact_pages WHERE owner_token = ${tokenValue} LIMIT 1`;
  return rows[0] ? rowToPage(rows[0] as Record<string, unknown>) : null;
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
  if (!page || !timingSafeEqual(page.ownerToken, ownerToken)) return null;

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
  input: { fromName: string; content: string; replyTo?: string | null }
): Promise<ContactMessage> {
  await ensureContactTables();
  const id = generateId('cmsg');
  const rows = await sql`
    INSERT INTO contact_messages (id, page_id, from_name, reply_to, content)
    VALUES (${id}, ${page.id}, ${input.fromName}, ${input.replyTo || null}, ${input.content})
    RETURNING *
  `;
  return rowToMessage(rows[0] as Record<string, unknown>);
}

function rowToMessage(row: Record<string, unknown>): ContactMessage {
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

export function ownerWebhookPayload(page: ContactPage, message: ContactMessage) {
  return {
    event: 'contact.message',
    version: 1,
    page: { slug: page.slug, name: page.name },
    message: {
      id: message.id,
      from: message.fromName,
      content: message.content,
      replyTo: message.replyTo,
      createdAt: message.createdAt,
    },
  };
}

export async function deliverOwnerWebhook(page: ContactPage, message: ContactMessage): Promise<WebhookDeliveryResult> {
  if (!page.webhookUrl) {
    return { delivered: false, statusCode: null, ack: null, error: 'no_webhook' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'aims.bot-linktree/1.0',
    'X-Aims-Event': 'contact.message',
  };
  if (page.webhookSecret) {
    headers['X-Aims-Secret'] = page.webhookSecret;
  }

  try {
    const res = await fetch(page.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(ownerWebhookPayload(page, message)),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      redirect: 'error',
    });

    const text = await res.text();
    let ack: string | null = null;
    try {
      const json = JSON.parse(text) as { ack?: unknown; message?: unknown };
      if (typeof json.ack === 'string') ack = json.ack;
      else if (typeof json.message === 'string') ack = json.message;
    } catch {
      if (text && text.length > 0 && text.length < 400) ack = text.trim();
    }

    return {
      delivered: res.ok,
      statusCode: res.status,
      ack,
      error: res.ok ? null : `webhook_http_${res.status}`,
    };
  } catch {
    return { delivered: false, statusCode: null, ack: null, error: 'webhook_unreachable' };
  }
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
