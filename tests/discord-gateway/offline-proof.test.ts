import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRawRequest } from '../helpers';
import { hashSecret } from '@/lib/crypto-tokens';
import { signAimsEvent } from '../../discord-gateway/src/hmac.mjs';
import { shouldForwardMessage } from '../../discord-gateway/src/filter.mjs';

const WORKER_SECRET = 'offline-proof-worker-secret';
const BOT_ID = 'aims-bot-id';

const PAGE_ROW = {
  id: 'pg-botlord',
  slug: 'abc123def456',
  owner_token: hashSecret('own_offline'),
  name: 'botlord',
  bio: '',
  avatar_url: '',
  webhook_url: 'https://owner.example/aims',
  webhook_secret: 'whsec_test',
  imessage: '',
  whatsapp: '',
  telegram: '',
  created_at: new Date('2026-09-25T00:00:00.000Z'),
  updated_at: new Date('2026-09-25T00:00:00.000Z'),
};

const BINDING_ROW = {
  id: 'dbnd-1',
  page_id: 'pg-botlord',
  guild_id: '111',
  channel_id: '222',
  mention_handle: 'botlord',
  created_at: new Date('2026-09-25T00:00:00.000Z'),
};

const MSG_ROW = {
  id: 'cmsg-offline',
  page_id: 'pg-botlord',
  from_name: 'alex',
  reply_to: null,
  content: 'hello proof',
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
  reply_token_hash: null,
  reply_expires_at: null,
  reply_count: 0,
};

describe('offline Discord e2e proof', () => {
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

  it('gateway mention → worker HMAC → Vercel wake → Discord **botlord:** reply', async () => {
    const message = {
      id: '333',
      channel_id: '222',
      guild_id: '111',
      content: `<@${BOT_ID}> botlord hello proof`,
      author: { id: 'human-1', username: 'alex' },
      mentions: [{ id: BOT_ID }],
    };
    expect(shouldForwardMessage(message, BOT_ID, BOT_ID)).toBe(true);

    const raw = JSON.stringify({ type: 'MESSAGE_CREATE', message });
    const ts = String(Math.floor(Date.now() / 1000));
    const nonce = 'offlineproofnonce00000000000001';
    const signature = signAimsEvent(WORKER_SECRET, ts, nonce, raw);

    const discordPosts: Array<{ content: string; allowed_mentions: unknown; message_reference: { message_id: string } }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('discord.com')) {
        const posted = JSON.parse(String(init?.body || '{}'));
        discordPosts.push(posted);
        return new Response(JSON.stringify({ id: '444', channel_id: '222' }), { status: 200 });
      }
      return new Response(JSON.stringify({ ack: 'hi from grok' }), { status: 200 });
    }));

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
    expect(discordPosts).toHaveLength(1);
    expect(discordPosts[0].content).toBe('**botlord:** hi from grok');
    expect(discordPosts[0].allowed_mentions).toEqual({ parse: [] });
    expect(discordPosts[0].message_reference.message_id).toBe('333');
  });
});
