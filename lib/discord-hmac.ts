import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const DISCORD_HMAC_MAX_SKEW_SEC = 300;
export const DISCORD_HMAC_MAX_BODY = 256 * 1024;

/**
 * Worker → Vercel signature.
 * X-Aims-Signature = hex(HMAC-SHA256(secret, `${timestamp}.${nonce}.${sha256(raw_body)}`))
 */
export function aimsEventSigningString(timestamp: string, nonce: string, rawBody: string | Buffer): string {
  const digest = createHash('sha256').update(rawBody).digest('hex');
  return `${timestamp}.${nonce}.${digest}`;
}

export function signAimsEvent(secret: string, timestamp: string, nonce: string, rawBody: string | Buffer): string {
  return createHmac('sha256', secret).update(aimsEventSigningString(timestamp, nonce, rawBody)).digest('hex');
}

export function verifyAimsEventSignature(opts: {
  secret: string;
  timestamp: string;
  nonce: string;
  signature: string;
  rawBody: string | Buffer;
  nowSec?: number;
}): { ok: true } | { ok: false; error: string } {
  const { secret, timestamp, nonce, signature, rawBody } = opts;
  if (!secret) return { ok: false, error: 'worker_secret_missing' };
  if (!timestamp || !nonce || !signature) return { ok: false, error: 'missing_hmac_headers' };
  if (Buffer.byteLength(rawBody) > DISCORD_HMAC_MAX_BODY) return { ok: false, error: 'body_too_large' };

  const ts = Number(timestamp);
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > DISCORD_HMAC_MAX_SKEW_SEC) {
    return { ok: false, error: 'timestamp_skew' };
  }

  const expected = signAimsEvent(secret, timestamp, nonce, rawBody);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, error: 'bad_signature' };
  }
  return { ok: true };
}
