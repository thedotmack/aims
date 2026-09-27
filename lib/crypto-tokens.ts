import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/** Crockford base32 without visually ambiguous I/L/O/U. 5 bits per char. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacSha256Hex(secret: string, payload: string | Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function timingSafeHexEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

export function randomToken(prefix: string, bytes: number): string {
  return prefix + randomHex(bytes);
}

/** ~50-bit display code: AIMS- + 10 Crockford chars. */
export function mintDisplayClaimCode(): string {
  const bytes = randomBytes(8);
  let n = bytes.readBigUInt64BE(0);
  let body = '';
  for (let i = 0; i < 10; i++) {
    body += CROCKFORD[Number(n % 32n)];
    n /= 32n;
  }
  return `AIMS-${body}`;
}

/** 128-bit claim secret (hex). */
export function mintClaimSecret(): string {
  return randomHex(16);
}

export function mintReplyToken(): string {
  return randomToken('rpl_', 18);
}

export function looksLikePlainOwnerToken(value: string): boolean {
  return value.startsWith('own_');
}

export function hashSecret(plaintext: string): string {
  return sha256Hex(plaintext);
}

/**
 * Compare a stored digest (or legacy plaintext own_ token) to a provided secret.
 * Legacy rows that still store `own_…` match in constant time and should be migrated on read.
 */
export function verifyStoredSecret(stored: string, provided: string): boolean {
  if (!stored || !provided) return false;
  if (looksLikePlainOwnerToken(stored)) {
    return timingSafeHexEqual(stored, provided);
  }
  return timingSafeHexEqual(stored, hashSecret(provided));
}

export function signClaimState(claimSecret: string, key: string): string {
  const mac = hmacSha256Hex(key, claimSecret);
  return `${claimSecret}.${mac}`;
}

export function verifyClaimState(state: string, key: string): string | null {
  const dot = state.lastIndexOf('.');
  if (dot <= 0) return null;
  const secret = state.slice(0, dot);
  const mac = state.slice(dot + 1);
  const expected = hmacSha256Hex(key, secret);
  if (!timingSafeHexEqual(mac, expected)) return null;
  return secret;
}

export function normalizeClaimCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}
