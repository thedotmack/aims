import { describe, it, expect } from 'vitest';
import {
  buildContactOptions,
  connectReadyPayload,
  hostedInboxToken,
  isSafeWebhookUrl,
  normalizePhone,
  ownerWebhookPayload,
  toPublicPage,
  type ContactPage,
} from '@/lib/contact-pages';

function samplePage(over: Partial<ContactPage> = {}): ContactPage {
  return {
    id: 'pg-1',
    slug: 'abc123def456',
    ownerToken: 'own_secret',
    name: 'Grok',
    bio: 'hi',
    avatarUrl: '',
    webhookUrl: 'https://owner.example/hook',
    webhookSecret: 's3cret',
    imessage: '+1 (555) 555-0100',
    whatsapp: '+15555550100',
    telegram: '@grok',
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...over,
  };
}

describe('hostedInboxToken', () => {
  it('recognizes this deployment hosted inbox URLs', () => {
    expect(hostedInboxToken('https://aims.bot/api/v1/inbox/inbox_deadbeefcafebabe')).toBe(
      'inbox_deadbeefcafebabe'
    );
    expect(hostedInboxToken('https://aims.bot/api/v1/inbox/inbox_aa/?x=1')).toBe('inbox_aa');
    expect(hostedInboxToken('https://www.aims.bot/api/v1/inbox/inbox_aa/')).toBe('inbox_aa');
  });

  it('rejects lookalikes so SSRF still applies', () => {
    expect(hostedInboxToken('https://inbox.example/hook')).toBeNull();
    expect(hostedInboxToken('https://evil.com/api/v1/inbox/inbox_aa')).toBeNull();
    expect(hostedInboxToken('https://aims.bot.attacker.com/api/v1/inbox/inbox_aa')).toBeNull();
    expect(hostedInboxToken('https://aims.bot/api/v1/pages/slug/message')).toBeNull();
    expect(hostedInboxToken('https://aims.bot/api/v1/inbox/inbox_aa/extra')).toBeNull();
    expect(hostedInboxToken('https://aims.bot/api/v1/inbox/not-an-inbox-token')).toBeNull();
  });
});

describe('isSafeWebhookUrl', () => {
  it('accepts https public hosts', () => {
    expect(isSafeWebhookUrl('https://hooks.example.com/aims').ok).toBe(true);
  });

  it('rejects private IPs and metadata', () => {
    expect(isSafeWebhookUrl('https://127.0.0.1/x').ok).toBe(false);
    expect(isSafeWebhookUrl('https://10.0.0.4/x').ok).toBe(false);
    expect(isSafeWebhookUrl('https://169.254.169.254/latest/meta-data').ok).toBe(false);
    expect(isSafeWebhookUrl('http://evil.example/x').ok).toBe(false);
  });

  it('rejects junk', () => {
    expect(isSafeWebhookUrl('not-a-url').ok).toBe(false);
  });
});

describe('contact deep links', () => {
  it('builds iMessage / WhatsApp / Telegram / CLI options', () => {
    const options = buildContactOptions(samplePage());
    expect(options.map((o) => o.id)).toEqual(['imessage', 'whatsapp', 'telegram', 'cli']);
    expect(options.find((o) => o.id === 'whatsapp')?.href).toBe('https://wa.me/15555550100');
    expect(options.find((o) => o.id === 'telegram')?.href).toBe('https://t.me/grok');
    expect(options.find((o) => o.id === 'cli')?.available).toBe(true);
  });

  it('adds a Discord row when a binding href is present', () => {
    const options = buildContactOptions(samplePage(), {
      discord: { href: 'https://discord.com/channels/111/222' },
    });
    expect(options.find((o) => o.id === 'discord')?.label).toBe('Discord');
    expect(options.find((o) => o.id === 'discord')?.kind).toBe('deeplink');
  });

  it('marks CLI unavailable when webhook is missing', () => {
    const options = buildContactOptions(samplePage({ webhookUrl: null }));
    expect(options.find((o) => o.id === 'cli')?.available).toBe(false);
  });

  it('normalizes phone digits', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('15551234567');
  });
});

describe('owner webhook payload', () => {
  it('is a contact.message event', () => {
    const page = samplePage();
    const payload = ownerWebhookPayload(page, {
      id: 'cmsg-1',
      pageId: page.id,
      fromName: 'visitor-bot',
      replyTo: 'https://visitor.example/hook',
      content: 'hello',
      delivered: false,
      deliveryStatus: 'pending',
      webhookStatus: null,
      ack: null,
      createdAt: '2026-09-23T00:00:00.000Z',
    });
    expect(payload.event).toBe('contact.message');
    expect(payload.page.slug).toBe(page.slug);
    expect(payload.message.from).toBe('visitor-bot');
    expect(payload.message.content).toBe('hello');
    expect('discord' in payload).toBe(false);
    expect('reply' in payload).toBe(false);
  });

  it('adds discord + reply only for Discord-originated wakes and does not leak owner tokens', () => {
    const page = samplePage();
    const payload = ownerWebhookPayload(page, {
      id: 'cmsg-1',
      pageId: page.id,
      fromName: 'alex',
      replyTo: null,
      content: 'hello',
      delivered: false,
      deliveryStatus: 'pending',
      webhookStatus: null,
      ack: null,
      createdAt: '2026-09-25T21:00:00.000Z',
    }, {
      discord: {
        guildId: '111',
        channelId: '222',
        threadId: null,
        sourceMessageId: '333',
        handle: 'botlord',
        hop: 0,
      },
      reply: {
        url: 'https://aims.bot/api/v1/pages/abc123/messages/cmsg-1/reply',
        token: 'rpl_test',
        expiresAt: '2026-09-26T21:00:00.000Z',
      },
    });
    expect(payload.event).toBe('contact.message');
    expect(payload.reply).toEqual({
      url: 'https://aims.bot/api/v1/pages/abc123/messages/cmsg-1/reply',
      token: 'rpl_test',
      expiresAt: '2026-09-26T21:00:00.000Z',
    });
    expect(payload.discord).toMatchObject({ handle: 'botlord', hop: 0 });
    expect(JSON.stringify(payload)).not.toContain('own_secret');
    expect(JSON.stringify(payload)).not.toContain('s3cret');
  });

  it('builds a connect.ready payload without secrets', () => {
    const payload = connectReadyPayload(samplePage(), {
      guildId: '111',
      channelId: '222',
      handle: 'botlord',
    });
    expect(payload.event).toBe('connect.ready');
    expect(payload.discord.mention).toBe('@aims botlord');
    expect(JSON.stringify(payload)).not.toContain('own_secret');
  });

  it('public JSON never includes owner token or webhook URL', () => {
    const json = toPublicPage(samplePage());
    expect(JSON.stringify(json)).not.toContain('own_secret');
    expect(JSON.stringify(json)).not.toContain('https://owner.example/hook');
    expect(json.bot2bot).toBe(true);
  });
});
