import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest } from '../helpers';
import { hashSecret } from '@/lib/crypto-tokens';

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

const MSG_ROW = {
  id: 'cmsg-discord',
  page_id: 'pg-test',
  from_name: 'alex',
  reply_to: null,
  content: 'hello',
  delivered: true,
  delivery_status: 'delivered',
  webhook_status: 200,
  ack: null,
  created_at: new Date('2026-09-25T00:00:00.000Z'),
  source: 'discord',
  hop: 0,
  discord_guild_id: '111',
  discord_channel_id: '222',
  discord_thread_id: null,
  discord_source_message_id: '333',
  reply_token_hash: hashSecret('rpl_testtoken'),
  reply_expires_at: new Date(Date.now() + 60_000),
  reply_count: 0,
};

describe('async Discord reply', () => {
  beforeEach(() => {
    clearMocks();
    vi.unstubAllGlobals();
    process.env.DISCORD_BOT_TOKEN = 'bot-token';
    process.env.DISCORD_API_BASE = 'https://discord.com/api/v10';
    setAllQueriesHandler((query) => {
      const q = query.toUpperCase();
      if (q.includes('FROM CONTACT_PAGES')) return [PAGE_ROW];
      if (q.includes('FROM CONTACT_MESSAGES')) return [MSG_ROW];
      if (q.includes('UPDATE CONTACT_MESSAGES')) return [{ ...MSG_ROW, reply_count: 1 }];
      return [];
    });
  });

  it('posts **botlord:** via Bot REST when the reply token matches', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ id: '444', channel_id: '222' }), { status: 200 })
    ));
    const { POST } = await import('@/app/api/v1/pages/[slug]/messages/[id]/reply/route');
    const res = await POST(
      createRequest('/api/v1/pages/slugslugslug/messages/cmsg-discord/reply', {
        method: 'POST',
        headers: { 'X-Aims-Reply-Token': 'rpl_testtoken' },
        body: { content: 'hi from grok' },
      }),
      { params: Promise.resolve({ slug: 'slugslugslug', id: 'cmsg-discord' }) }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.discord.messageId).toBe('444');
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(String(init.body)).content).toBe('**botlord:** hi from grok');
  });

  it('rejects a bad reply token', async () => {
    const { POST } = await import('@/app/api/v1/pages/[slug]/messages/[id]/reply/route');
    const res = await POST(
      createRequest('/api/v1/pages/slugslugslug/messages/cmsg-discord/reply', {
        method: 'POST',
        headers: { 'X-Aims-Reply-Token': 'rpl_nope' },
        body: { content: 'hi' },
      }),
      { params: Promise.resolve({ slug: 'slugslugslug', id: 'cmsg-discord' }) }
    );
    expect(res.status).toBe(401);
  });
});
