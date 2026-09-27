import { generateKeyPairSync, sign } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRawRequest, createRequest } from '../helpers';
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

describe('Discord connect + interactions', () => {
  beforeEach(() => {
    clearMocks();
    vi.unstubAllGlobals();
    process.env.DISCORD_CLIENT_ID = 'client-id';
    process.env.DISCORD_CLIENT_SECRET = 'client-secret';
    process.env.DISCORD_BOT_TOKEN = 'bot-token';
    process.env.DISCORD_WORKER_SECRET = 'worker-secret';
    setAllQueriesHandler((query) => {
      const q = query.toUpperCase();
      if (q.includes('FROM CONTACT_PAGES')) return [PAGE_ROW];
      if (q.includes('INSERT INTO DISCORD_CLAIMS')) return [];
      if (q.includes('SELECT COUNT(*)')) return [{ count: 0 }];
      if (q.includes('FROM DISCORD_CLAIMS')) return [{
        id: 'clm-1',
        code_hash: hashSecret('AIMS-TESTCODE1'),
        secret_hash: hashSecret('aabbccddeeff00112233445566778899'),
        page_id: 'pg-test',
        expires_at: new Date(Date.now() + 60_000),
        consumed_at: null,
        created_at: new Date(),
      }];
      if (q.includes('FROM DISCORD_BINDINGS')) return [];
      return [];
    });
  });

  it('mints a hashed claim and advanced OAuth installUrl', async () => {
    const { POST } = await import('@/app/api/v1/pages/[slug]/connect/route');
    const res = await POST(
      createRequest('/api/v1/pages/slugslugslug/connect', {
        method: 'POST',
        headers: { authorization: 'Bearer own_abc' },
        body: { channels: ['discord'] },
      }),
      { params: Promise.resolve({ slug: 'slugslugslug' }) }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.claim).toMatch(/^AIMS-[0-9A-Z]+$/);
    expect(data.claimSecret).toMatch(/^[0-9a-f]{32}$/);
    expect(data.discord.installUrl).toContain('response_type=code');
    expect(data.discord.installUrl).toContain('identify');
    expect(data.discord.installUrl).toContain('redirect_uri=');
    expect(data.discord.installUrl).not.toContain(data.claim);
  });

  it('rejects connect without a header owner token', async () => {
    const { POST } = await import('@/app/api/v1/pages/[slug]/connect/route');
    const res = await POST(
      createRequest('/api/v1/pages/slugslugslug/connect?token=own_abc', {
        method: 'POST',
        body: { channels: ['discord'] },
      }),
      { params: Promise.resolve({ slug: 'slugslugslug' }) }
    );
    expect(res.status).toBe(401);
  });

  it('public claim status does not leak page or guild', async () => {
    const { GET } = await import('@/app/api/v1/claims/[code]/route');
    const res = await GET(
      createRequest('/api/v1/claims/AIMS-TESTCODE1'),
      { params: Promise.resolve({ code: 'AIMS-TESTCODE1' }) }
    );
    const data = await res.json();
    expect(data.status).toBe('pending');
    expect(data.page).toBeUndefined();
    expect(data.discord).toBeUndefined();
  });

  it('answers Discord PING after Ed25519 verify', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const rawPub = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
    process.env.DISCORD_PUBLIC_KEY = Buffer.from(rawPub).toString('hex');
    const body = '{"type":1}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');

    const { POST } = await import('@/app/api/v1/discord/interactions/route');
    const res = await POST(createRawRequest('/api/v1/discord/interactions', {
      body,
      headers: {
        'X-Signature-Timestamp': timestamp,
        'X-Signature-Ed25519': signature,
      },
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 1 });
  });

  it('rejects interactions with a bad signature', async () => {
    process.env.DISCORD_PUBLIC_KEY = 'ab'.repeat(32);
    const { POST } = await import('@/app/api/v1/discord/interactions/route');
    const res = await POST(createRawRequest('/api/v1/discord/interactions', {
      body: '{"type":1}',
      headers: {
        'X-Signature-Timestamp': '1',
        'X-Signature-Ed25519': 'cd'.repeat(32),
      },
    }));
    expect(res.status).toBe(401);
  });
});
