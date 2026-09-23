import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMocks, setAllQueriesHandler } from '../setup';
import { createRequest } from '../helpers';

const PAGE_ROW = {
  id: 'pg-test',
  slug: 'slugslugslug',
  owner_token: 'own_abc',
  name: 'Proof Bot',
  bio: 'bot2bot',
  avatar_url: '',
  webhook_url: 'https://inbox.example/hook',
  webhook_secret: null,
  imessage: '',
  whatsapp: '',
  telegram: 'proof',
  created_at: new Date('2026-09-23T00:00:00.000Z'),
  updated_at: new Date('2026-09-23T00:00:00.000Z'),
};

const MSG_ROW = {
  id: 'cmsg-test',
  page_id: 'pg-test',
  from_name: 'visitor-bot',
  reply_to: null,
  content: 'hello from test',
  delivered: false,
  delivery_status: 'pending',
  webhook_status: null,
  ack: null,
  created_at: new Date('2026-09-23T00:00:00.000Z'),
};

describe('pages + bot2bot API', () => {
  beforeEach(() => {
    clearMocks();
    vi.unstubAllGlobals();
    setAllQueriesHandler((query) => {
      const q = query.toUpperCase();
      if (q.includes('INSERT INTO CONTACT_PAGES')) return [PAGE_ROW];
      if (q.includes('SELECT * FROM CONTACT_PAGES')) return [PAGE_ROW];
      if (q.includes('INSERT INTO CONTACT_MESSAGES')) return [MSG_ROW];
      if (q.includes('UPDATE CONTACT_MESSAGES')) {
        return [{ ...MSG_ROW, delivered: true, delivery_status: 'delivered', webhook_status: 200, ack: 'inbox-received' }];
      }
      if (q.includes('INSERT INTO WEBHOOK_INBOX')) return [];
      if (q.includes('SELECT PAYLOADS FROM WEBHOOK_INBOX')) return [];
      if (q.includes('SELECT TOKEN, PAYLOADS')) return [{ token: 'inbox_x', payloads: '[]' }];
      return [];
    });
  });

  it('creates a page and returns owner token + private URL', async () => {
    const { POST } = await import('@/app/api/v1/pages/route');
    const res = await POST(createRequest('/api/v1/pages', {
      method: 'POST',
      body: { name: 'Proof Bot', webhookUrl: 'https://inbox.example/hook', telegram: 'proof' },
    }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.ownerToken).toBeTruthy();
    expect(data.page.urls.page).toContain('/p/');
    expect(data.page.bot2bot).toBe(true);
    expect(JSON.stringify(data.page)).not.toContain('https://inbox.example/hook');
  });

  it('rejects private webhook hosts', async () => {
    const { POST } = await import('@/app/api/v1/pages/route');
    const res = await POST(createRequest('/api/v1/pages', {
      method: 'POST',
      body: { name: 'Nope', webhookUrl: 'https://10.0.0.8/hook' },
    }));
    expect(res.status).toBe(400);
  });

  it('discovers contacts without secrets', async () => {
    const { GET } = await import('@/app/api/v1/pages/[slug]/contact/route');
    const res = await GET(
      createRequest('/api/v1/pages/slugslugslug/contact'),
      { params: Promise.resolve({ slug: 'slugslugslug' }) }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.bot2bot).toBe(true);
    expect(data.contacts.some((c: { id: string }) => c.id === 'cli')).toBe(true);
    expect(JSON.stringify(data)).not.toContain('own_abc');
  });

  it('delivers a visitor message to the owner webhook and returns ack', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ ack: 'inbox-received' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    ));

    const { POST } = await import('@/app/api/v1/pages/[slug]/message/route');
    const res = await POST(
      createRequest('/api/v1/pages/slugslugslug/message', {
        method: 'POST',
        body: { from: 'visitor-bot', content: 'hello from test' },
      }),
      { params: Promise.resolve({ slug: 'slugslugslug' }) }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.delivered).toBe(true);
    expect(data.ack).toBe('inbox-received');
    expect(fetch).toHaveBeenCalled();
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const payload = JSON.parse(String(init.body));
    expect(payload.event).toBe('contact.message');
    expect(payload.message.from).toBe('visitor-bot');
  });

  it('returns 409 when the page has no webhook', async () => {
    setAllQueriesHandler((query) => {
      if (query.toUpperCase().includes('SELECT * FROM CONTACT_PAGES')) {
        return [{ ...PAGE_ROW, webhook_url: null }];
      }
      return [];
    });
    const { POST } = await import('@/app/api/v1/pages/[slug]/message/route');
    const res = await POST(
      createRequest('/api/v1/pages/slugslugslug/message', {
        method: 'POST',
        body: { from: 'x', content: 'hi' },
      }),
      { params: Promise.resolve({ slug: 'slugslugslug' }) }
    );
    expect(res.status).toBe(409);
  });
});
