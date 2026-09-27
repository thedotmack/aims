import { LIMITS, checkRateLimitAsync } from './ratelimit';

/**
 * Official Discord permission flags used at install time
 * (https://discord.com/developers/docs/topics/permissions#permissions-bitwise-permission-flags):
 *   VIEW_CHANNEL             1 << 10 = 1024
 *   SEND_MESSAGES            1 << 11 = 2048
 *   EMBED_LINKS              1 << 14 = 16384
 *   READ_MESSAGE_HISTORY     1 << 16 = 65536
 *   USE_APPLICATION_COMMANDS 1 << 31 = 2147483648
 *   SEND_MESSAGES_IN_THREADS 1 << 38 = 274877906944
 * Sum documented here so we do not invent bits.
 */
export const DISCORD_BOT_PERMISSIONS = (
  (BigInt(1) << BigInt(10)) |
  (BigInt(1) << BigInt(11)) |
  (BigInt(1) << BigInt(14)) |
  (BigInt(1) << BigInt(16)) |
  (BigInt(1) << BigInt(31)) |
  (BigInt(1) << BigInt(38))
).toString();

export const DISCORD_SCOPES = 'bot applications.commands identify';
export const DISCORD_API_VERSION = 'v10';

export function discordApiBase(): string {
  return (process.env.DISCORD_API_BASE || `https://discord.com/api/${DISCORD_API_VERSION}`).replace(/\/$/, '');
}

export function discordClientId(): string {
  return process.env.DISCORD_CLIENT_ID || '';
}

export function discordBotToken(): string {
  return process.env.DISCORD_BOT_TOKEN || '';
}

export function discordBotUserId(): string {
  return process.env.DISCORD_BOT_USER_ID || process.env.DISCORD_CLIENT_ID || '';
}

export function discordPublicKey(): string {
  return process.env.DISCORD_PUBLIC_KEY || '';
}

export function discordWorkerSecret(): string {
  return process.env.DISCORD_WORKER_SECRET || '';
}

export function discordStateKey(): string {
  return process.env.DISCORD_CLIENT_SECRET || process.env.DISCORD_WORKER_SECRET || '';
}

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.search) url.search = '';
    if (url.password) url.password = '';
    return url.toString();
  } catch {
    return '[redacted-url]';
  }
}

async function discordFetch(path: string, init: RequestInit = {}, token?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  const auth = token || discordBotToken();
  if (auth && !headers.has('authorization')) {
    headers.set('authorization', auth.startsWith('Bot ') || auth.startsWith('Bearer ') ? auth : `Bot ${auth}`);
  }
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const url = path.startsWith('http') ? path : `${discordApiBase()}${path}`;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 429) {
    const json = await res.clone().json().catch(() => ({})) as { retry_after?: number };
    const retryAfter = Number(json.retry_after ?? res.headers.get('retry-after') ?? 0);
    if (retryAfter > 0 && retryAfter < 2) {
      await new Promise((resolve) => setTimeout(resolve, Math.ceil(retryAfter * 1000)));
      return fetch(url, { ...init, headers });
    }
  }
  return res;
}

export async function discordCreateMessage(input: {
  channelId: string;
  content: string;
  messageReference?: { messageId: string; channelId?: string; guildId?: string };
}): Promise<{ ok: true; messageId: string; channelId: string } | { ok: false; status: number; error: string }> {
  const global = await checkRateLimitAsync({ name: 'discord-rest-global', max: 40, windowMs: 1000 }, 'bot');
  if (!global.allowed) {
    return { ok: false, status: 429, error: 'global_rate_limit' };
  }
  const body: Record<string, unknown> = {
    content: input.content,
    allowed_mentions: { parse: [] },
  };
  if (input.messageReference) {
    body.message_reference = {
      message_id: input.messageReference.messageId,
      channel_id: input.messageReference.channelId,
      guild_id: input.messageReference.guildId,
      fail_if_not_exists: false,
    };
  }
  const res = await discordFetch(`/channels/${input.channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: res.status, error: 'discord_forbidden' };
  }
  if (res.status === 404) {
    return { ok: false, status: 404, error: 'discord_not_found' };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, error: `discord_http_${res.status}` };
  }
  const json = await res.json() as { id: string; channel_id: string };
  return { ok: true, messageId: json.id, channelId: json.channel_id };
}

export async function discordGetChannelMessages(channelId: string, limit = 20): Promise<unknown[]> {
  const res = await discordFetch(`/channels/${channelId}/messages?limit=${Math.min(limit, 100)}`);
  if (!res.ok) return [];
  return res.json() as Promise<unknown[]>;
}

export async function discordGetGuild(guildId: string): Promise<{
  id: string;
  name?: string;
  system_channel_id?: string | null;
} | null> {
  const res = await discordFetch(`/guilds/${guildId}`);
  if (!res.ok) return null;
  return res.json() as Promise<{ id: string; name?: string; system_channel_id?: string | null }>;
}

export async function discordGetBotMember(guildId: string): Promise<{ id: string; permissions?: string } | null> {
  const res = await discordFetch(`/guilds/${guildId}/members/@me`);
  if (!res.ok) return null;
  return res.json() as Promise<{ id: string; permissions?: string }>;
}

export async function discordListGuildChannels(guildId: string): Promise<Array<{
  id: string;
  type: number;
  name?: string;
}>> {
  const res = await discordFetch(`/guilds/${guildId}/channels`);
  if (!res.ok) return [];
  return res.json() as Promise<Array<{ id: string; type: number; name?: string }>>;
}

const GUILD_TEXT = 0;
const GUILD_ANNOUNCEMENT = 5;
const PUBLIC_THREAD = 11;
const PRIVATE_THREAD = 12;

export function isSendableChannelType(type: number): boolean {
  return type === GUILD_TEXT || type === GUILD_ANNOUNCEMENT || type === PUBLIC_THREAD || type === PRIVATE_THREAD;
}

export async function pickDefaultSendableChannel(guildId: string): Promise<string | null> {
  const guild = await discordGetGuild(guildId);
  const channels = await discordListGuildChannels(guildId);
  if (guild?.system_channel_id && channels.some((c) => c.id === guild.system_channel_id && isSendableChannelType(c.type))) {
    return guild.system_channel_id;
  }
  const first = channels.find((c) => isSendableChannelType(c.type));
  return first?.id || null;
}

export async function discordExchangeCode(code: string, redirectUri: string): Promise<{
  access_token?: string;
  token_type?: string;
  guild?: { id: string };
} | null> {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || '',
    client_secret: process.env.DISCORD_CLIENT_SECRET || '',
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(`${discordApiBase()}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ access_token?: string; token_type?: string; guild?: { id: string } }>;
}

export async function discordGetUserGuilds(userAccessToken: string): Promise<Array<{ id: string; permissions?: string }>> {
  const res = await discordFetch('/users/@me/guilds', {}, `Bearer ${userAccessToken}`);
  if (!res.ok) return [];
  return res.json() as Promise<Array<{ id: string; permissions?: string }>>;
}

export function userHasManageGuild(permissions?: string): boolean {
  if (!permissions) return false;
  try {
    return (BigInt(permissions) & (BigInt(1) << BigInt(5))) !== BigInt(0);
  } catch {
    return false;
  }
}

export function buildInstallUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('scope', DISCORD_SCOPES);
  url.searchParams.set('permissions', DISCORD_BOT_PERMISSIONS);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', input.state);
  return url.toString();
}

export async function discordInteractionFollowup(appId: string, interactionToken: string, content: string): Promise<void> {
  await discordFetch(`/webhooks/${appId}/${interactionToken}`, {
    method: 'POST',
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
}

export { LIMITS };
