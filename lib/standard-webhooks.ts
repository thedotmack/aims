import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Standard Webhooks signing (https://www.standardwebhooks.com).
 * signed_content = `${id}.${timestamp}.${body}`
 * secret = base64(bytes) after optional `whsec_` prefix
 * webhook-signature = `v1,${base64(HMAC_SHA256(secret, signed_content))}`
 */

export interface StandardWebhookHeaders {
  'webhook-id': string;
  'webhook-timestamp': string;
  'webhook-signature': string;
}

export function toStandardWebhookSecret(raw: string): string {
  if (raw.startsWith('whsec_')) return raw;
  return `whsec_${Buffer.from(raw, 'utf8').toString('base64')}`;
}

export function decodeWebhookSecret(secret: string): Buffer {
  const raw = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  return Buffer.from(raw, 'base64');
}

export function signStandardWebhook(
  secret: string,
  body: string,
  opts?: { id?: string; timestamp?: number }
): StandardWebhookHeaders {
  const id = opts?.id || `msg_${randomBytes(16).toString('hex')}`;
  const timestamp = String(opts?.timestamp ?? Math.floor(Date.now() / 1000));
  const key = decodeWebhookSecret(secret);
  const signed = `${id}.${timestamp}.${body}`;
  const sig = createHmac('sha256', key).update(signed).digest('base64');
  return {
    'webhook-id': id,
    'webhook-timestamp': timestamp,
    'webhook-signature': `v1,${sig}`,
  };
}

export function verifyStandardWebhook(
  secret: string,
  body: string,
  headers: { id: string; timestamp: string; signature: string },
  opts?: { now?: number; maxSkewSec?: number }
): boolean {
  const now = opts?.now ?? Math.floor(Date.now() / 1000);
  const ts = Number(headers.timestamp);
  const maxSkew = opts?.maxSkewSec ?? 300;
  if (!Number.isFinite(ts) || Math.abs(now - ts) > maxSkew) return false;

  const key = decodeWebhookSecret(secret);
  const signed = `${headers.id}.${headers.timestamp}.${body}`;
  const expected = createHmac('sha256', key).update(signed).digest('base64');
  const parts = headers.signature.split(/\s+/);
  for (const part of parts) {
    const [ver, sig] = part.split(',', 2);
    if (ver !== 'v1' || !sig) continue;
    const left = Buffer.from(sig);
    const right = Buffer.from(expected);
    if (left.length === right.length && timingSafeEqual(left, right)) return true;
  }
  return false;
}
