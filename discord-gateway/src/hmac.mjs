import { createHash, createHmac, randomBytes } from 'node:crypto';

/** Must match lib/discord-hmac.ts: HMAC-SHA256(secret, `${ts}.${nonce}.${sha256(raw_body)}`) */
export function signAimsEvent(secret, timestamp, nonce, rawBody) {
  const digest = createHash('sha256').update(rawBody).digest('hex');
  return createHmac('sha256', secret).update(`${timestamp}.${nonce}.${digest}`).digest('hex');
}

export function mintNonce() {
  return randomBytes(16).toString('hex');
}

export function buildSignedHeaders(secret, rawBody, nowSec = Math.floor(Date.now() / 1000)) {
  const timestamp = String(nowSec);
  const nonce = mintNonce();
  return {
    'content-type': 'application/json',
    'x-aims-timestamp': timestamp,
    'x-aims-nonce': nonce,
    'x-aims-signature': signAimsEvent(secret, timestamp, nonce, rawBody),
  };
}
