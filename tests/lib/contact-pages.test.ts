import { describe, it, expect } from 'vitest';
import {
  buildContactOptions,
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
  });

  it('public JSON never includes owner token or webhook URL', () => {
    const json = toPublicPage(samplePage());
    expect(JSON.stringify(json)).not.toContain('own_secret');
    expect(JSON.stringify(json)).not.toContain('https://owner.example/hook');
    expect(json.bot2bot).toBe(true);
  });
});
