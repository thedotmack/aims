import { describe, expect, it } from 'vitest';
import { signAimsEvent, verifyAimsEventSignature } from '@/lib/discord-hmac';

describe('aims worker HMAC', () => {
  const secret = 'worker-secret';
  const body = '{"type":"MESSAGE_CREATE"}';
  const ts = '1758830000';
  const nonce = 'aabbccddeeff00112233445566778899';

  it('accepts a matching signature within skew', () => {
    const signature = signAimsEvent(secret, ts, nonce, body);
    expect(verifyAimsEventSignature({
      secret,
      timestamp: ts,
      nonce,
      signature,
      rawBody: body,
      nowSec: 1_758_830_000,
    })).toEqual({ ok: true });
  });

  it('rejects a bad signature, stale timestamp, and oversized body', () => {
    const signature = signAimsEvent(secret, ts, nonce, body);
    expect(verifyAimsEventSignature({
      secret, timestamp: ts, nonce, signature: '00', rawBody: body, nowSec: 1_758_830_000,
    }).ok).toBe(false);
    expect(verifyAimsEventSignature({
      secret, timestamp: ts, nonce, signature, rawBody: body, nowSec: 1_758_830_000 + 301,
    }).ok).toBe(false);
    expect(verifyAimsEventSignature({
      secret, timestamp: ts, nonce, signature, rawBody: 'x'.repeat(256 * 1024 + 1), nowSec: 1_758_830_000,
    }).ok).toBe(false);
  });
});
