import { describe, expect, it } from 'vitest';
import { Webhook } from 'standardwebhooks';
import { signStandardWebhook, toStandardWebhookSecret, verifyStandardWebhook } from '@/lib/standard-webhooks';

describe('Standard Webhooks', () => {
  it('signs a fixture that the official library verifies', () => {
    const secret = toStandardWebhookSecret('test-owner-secret');
    const body = JSON.stringify({ event: 'contact.message', version: 1 });
    const now = Math.floor(Date.now() / 1000);
    const headers = signStandardWebhook(secret, body, {
      id: 'msg_fixture_1',
      timestamp: now,
    });

    const wh = new Webhook(secret);
    const verified = wh.verify(body, {
      'webhook-id': headers['webhook-id'],
      'webhook-timestamp': headers['webhook-timestamp'],
      'webhook-signature': headers['webhook-signature'],
    });
    expect(verified).toEqual(JSON.parse(body));
    expect(verifyStandardWebhook(secret, body, {
      id: headers['webhook-id'],
      timestamp: headers['webhook-timestamp'],
      signature: headers['webhook-signature'],
    }, { now })).toBe(true);
  });
});
