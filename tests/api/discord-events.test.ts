import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRawRequest, createRequest } from '../helpers';
import { signAimsEvent } from '@/lib/discord-hmac';
import { hashSecret } from '@/lib/crypto-tokens';

const WORKER_SECRET = 'test-worker-secret';
const BOT_ID = 'aims-bot-id';

const PAGE_ROW = {
  id: 'pg-test',
  slug: 'slugslugslug',
  owner_token: hashSecret('own_abc'),
  name: 'botlord',
  bio: '',
  avatar_url: '',
  webhook_url: 'https://inbox.example/hook',
  webhook_secret: null,
  imessage: '',
  whatsapp: '',
  telegram: '',
  created_at: new Date('2026-09-25T00:00:00.000Z'),
  updated_at: new Date('2026-09-25T00:00:00.000Z'),
};

const BINDING_ROW = {
  id: 'dbnd-1',
  page_id: 'pg-test',
  guild_id: '111',
  channel_id: '222',
  mention_handle: 'botlord',
  created_at: new Date('2026-09-25T00:00:00.000Z'),
};

const MSG_ROW = {
  id: 'cmsg-discord',
  page_id: 'pg-test',
  from_name: 'alex',
  reply_to: null,
  content: 'hello',
  delivered: false,
  delivery_status: 'pending',
  webhook_status: null,
  ack: null,
  created_at: new Date('2026-09-25T00:00:00.000Z'),
  source: 'discord',
  hop: 0,
  discord_guild_id: '111',
  discord_channel_id: '222',
  discord_thread_id: null,
  discord_source_message_id: '333',
  reply_token_hash: hashSecret('rpl_test'),
  reply_expires_at: new Date(Date.now() + 60_000),
  reply_count: 0,
};

function mentionMessage(over: Record<string, unknown> = {}) {
  return {
    id: '333',
    channel_id: '222',
    guild_id: '111',
    content: `<@${BOT_ID}> botlord hello`,
    author: { id: 'human-1', username: 'alex' },
    mentions: [{ id: BOT_ID }],
    ...over,
  };
}

function signedEvent(message: Record<string, unknown>, over: { ts?: string; nonce?: string; signature?: string } = {}) {
  const raw = JSON.stringify({ type: 'MESSAGE_CREATE', message });
  const ts = over.ts ?? String(Math.floor(Date.now() / 1000));
  const nonce = over.nonce ?? `nonce${Math.random().toString(16).slice(2)}`.padEnd(32, '0');
  const signature = over.signature ?? signAimsEvent(WORKER_SECRET, ts, nonce, raw);
  return { raw, ts, nonce, signature };
}

describe('POST /api/v1/discord/events', () => {
  beforeEach(() => {
    clearMocks();
    vi.unstubAllGlobals();
    process.env.DISCORD_WORKER_SECRET = WORKER_SECRET;
    process.env.DISCORD_CLIENT_ID = BOT_ID;
    process.env.DISCORD_BOT_USER_ID = BOT_ID;
    process.env.DISCORD_BOT_TOKEN = 'bot-token';
    process.env.DISCORD_API_BASE = 'https://discord.com/api/v10';
    setAllQueriesHandler((query) => {
      const q = query.toUpperCase();
      if (q.includes('INSERT INTO DISCORD_EVENT_NONCES')) return [];
      if (q.includes('FROM DISCORD_BINDINGS')) return [BINDING_ROW];
      if (q.includes('FROM CONTACT_PAGES')) return [PAGE_ROW];
      if (q.includes('INSERT INTO CONTACT_MESSAGES')) return [MSG_ROW];
      if (q.includes('UPDATE CONTACT_MESSAGES')) return [MSG_ROW];
      if (q.includes('FROM DISCORD_COOLDOWNS')) return [];
      if (q.includes('INSERT INTO DISCORD_COOLDOWNS')) return [];
      if (q.includes('SELECT HOP FROM CONTACT_MESSAGES')) return [];
      return [];
    });
  });

  it('wakes the owner on @aims botlord and posts the ack as **botlord:**', async () => {
    const fetches: Array<{ url: string; body: string; headers: Headers }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = String(init?.body || '');
      fetches.push({ url: String(url), body, headers: new Headers(init?.headers) });
      if (String(url).includes('discord.com')) {
        return new Response(JSON.stringify({ id: '444', channel_id: '222' }), { status: 200 });
      }
      return new Response(JSON.stringify({ ack: 'hi from grok' }), { status: 200 });
    }));

    const { raw, ts, nonce, signature } = signedEvent(mentionMessage());
    const { POST } = await import('@/app/api/v1/discord/events/route');
    const res = await POST(createRawRequest('/api/v1/discord/events', {
      body: raw,
      headers: {
        'X-Aims-Timestamp': ts,
        'X-Aims-Nonce': nonce,
        'X-Aims-Signature': signature,
      },
    }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, wakes: 1 });

    const wake = fetches.find((f) => f.url.includes('inbox.example'));
    expect(wake).toBeTruthy();
    const payload = JSON.parse(wake!.body);
    expect(payload.event).toBe('contact.message');
    expect(payload.discord.handle).toBe('botlord');
    expect(payload.reply.url).toContain('/reply');
    expect(payload.reply.token).toBeTruthy();
    expect(JSON.stringify(payload)).not.toContain('own_abc');

    const discordPost = fetches.find((f) => f.url.includes('/channels/222/messages'));
    expect(discordPost).toBeTruthy();
    const posted = JSON.parse(discordPost!.body);
    expect(posted.content).toBe('**botlord:** hi from grok');
    expect(posted.allowed_mentions).toEqual({ parse: [] });
    expect(posted.message_reference.message_id).toBe('333');
  });

  it('ignores messages that do not mention the app', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { raw, ts, nonce, signature } = signedEvent(mentionMessage({
      mentions: [],
      content: 'botlord hello',
    }));
    const { POST } = await import('@/app/api/v1/discord/events/route');
    const res = await POST(createRawRequest('/api/v1/discord/events', {
      body: raw,
      headers: { 'X-Aims-Timestamp': ts, 'X-Aims-Nonce': nonce, 'X-Aims-Signature': signature },
    }));
    expect(await res.json()).toEqual({ ok: true, ignored: 'no_mention' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('ignores self authors', async () => {
    const { raw, ts, nonce, signature } = signedEvent(mentionMessage({
      author: { id: BOT_ID, username: 'aims' },
    }));
    const { POST } = await import('@/app/api/v1/discord/events/route');
    const res = await POST(createRawRequest('/api/v1/discord/events', {
      body: raw,
      headers: { 'X-Aims-Timestamp': ts, 'X-Aims-Nonce': nonce, 'X-Aims-Signature': signature },
    }));
    expect(await res.json()).toEqual({ ok: true, ignored: 'self' });
  });

  it('drops hop 4', async () => {
    setAllQueriesHandler((query) => {
      const q = query.toUpperCase();
      if (q.includes('INSERT INTO DISCORD_EVENT_NONCES')) return [];
      if (q.includes('FROM DISCORD_BINDINGS')) return [BINDING_ROW];
      if (q.includes('SELECT HOP FROM CONTACT_MESSAGES')) return [{ hop: 3 }];
      if (q.includes('FROM CONTACT_PAGES')) return [PAGE_ROW];
      return [];
    });
    const { raw, ts, nonce, signature } = signedEvent(mentionMessage({
      message_reference: { message_id: 'parent-aims' },
    }));
    const { POST } = await import('@/app/api/v1/discord/events/route');
    const res = await POST(createRawRequest('/api/v1/discord/events', {
      body: raw,
      headers: { 'X-Aims-Timestamp': ts, 'X-Aims-Nonce': nonce, 'X-Aims-Signature': signature },
    }));
    expect(await res.json()).toEqual({ ok: true, ignored: 'hop_exceeded' });
  });

  it('rejects HMAC fail, stale timestamp, and reused nonce', async () => {
    const { POST } = await import('@/app/api/v1/discord/events/route');
    const good = signedEvent(mentionMessage());
    const badSig = await POST(createRawRequest('/api/v1/discord/events', {
      body: good.raw,
      headers: { 'X-Aims-Timestamp': good.ts, 'X-Aims-Nonce': good.nonce, 'X-Aims-Signature': 'deadbeef' },
    }));
    expect(badSig.status).toBe(401);

    const stale = signedEvent(mentionMessage(), { ts: String(Math.floor(Date.now() / 1000) - 400) });
    const staleRes = await POST(createRawRequest('/api/v1/discord/events', {
      body: stale.raw,
      headers: { 'X-Aims-Timestamp': stale.ts, 'X-Aims-Nonce': stale.nonce, 'X-Aims-Signature': stale.signature },
    }));
    expect(staleRes.status).toBe(401);

    setAllQueriesHandler((query) => {
      if (query.toUpperCase().includes('INSERT INTO DISCORD_EVENT_NONCES')) {
        throw new Error('duplicate key');
      }
      return [];
    });
    const reused = signedEvent(mentionMessage());
    const reusedRes = await POST(createRawRequest('/api/v1/discord/events', {
      body: reused.raw,
      headers: { 'X-Aims-Timestamp': reused.ts, 'X-Aims-Nonce': reused.nonce, 'X-Aims-Signature': reused.signature },
    }));
    expect(reusedRes.status).toBe(401);
  });

  it('public GET page has no webhook URL or token', async () => {
    const { GET } = await import('@/app/api/v1/pages/[slug]/route');
    const res = await GET(
      createRequest('/api/v1/pages/slugslugslug'),
      { params: Promise.resolve({ slug: 'slugslugslug' }) }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(JSON.stringify(data)).not.toContain('inbox.example');
    expect(JSON.stringify(data)).not.toContain('own_abc');
    expect(data.page.bot2bot).toBe(true);
  });
});
