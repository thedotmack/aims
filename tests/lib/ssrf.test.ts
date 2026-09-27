import { afterEach, describe, expect, it } from 'vitest';
import {
  _setSsrfLookup,
  isBlockedIp,
  resolveAndPinPublicUrl,
} from '@/lib/ssrf';

describe('isBlockedIp', () => {
  it('rejects loopback, RFC1918, link-local, CGNAT, and metadata', () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true);
    expect(isBlockedIp('10.1.2.3')).toBe(true);
    expect(isBlockedIp('192.168.1.9')).toBe(true);
    expect(isBlockedIp('172.16.0.4')).toBe(true);
    expect(isBlockedIp('169.254.169.254')).toBe(true);
    expect(isBlockedIp('100.64.1.1')).toBe(true);
    expect(isBlockedIp('0.0.0.0')).toBe(true);
  });

  it('rejects IPv6 loopback, ULA, and IPv4-mapped private', () => {
    expect(isBlockedIp('::1')).toBe(true);
    expect(isBlockedIp('fd00::1')).toBe(true);
    expect(isBlockedIp('fe80::1')).toBe(true);
    expect(isBlockedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedIp('::ffff:10.0.0.1')).toBe(true);
    expect(isBlockedIp('::ffff:169.254.169.254')).toBe(true);
  });

  it('allows public IPv4', () => {
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('1.1.1.1')).toBe(false);
  });
});

describe('resolveAndPinPublicUrl', () => {
  afterEach(() => {
    _setSsrfLookup(async () => ['8.8.8.8']);
  });

  it('rejects a literal private URL', async () => {
    const result = await resolveAndPinPublicUrl('https://10.0.0.8/hook');
    expect(result.ok).toBe(false);
  });

  it('rejects DNS that resolves to a private address', async () => {
    _setSsrfLookup(async () => ['10.0.0.4']);
    const result = await resolveAndPinPublicUrl('https://evil.example/hook');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/private/i);
  });

  it('rejects DNS that returns any private among mixed answers', async () => {
    _setSsrfLookup(async () => ['1.1.1.1', '169.254.169.254']);
    const result = await resolveAndPinPublicUrl('https://rebind.example/hook');
    expect(result.ok).toBe(false);
  });

  it('rejects IPv6 ULA from DNS', async () => {
    _setSsrfLookup(async () => ['fd12:3456:789a::1']);
    const result = await resolveAndPinPublicUrl('https://ula.example/hook');
    expect(result.ok).toBe(false);
  });

  it('rejects IPv4-mapped loopback from DNS', async () => {
    _setSsrfLookup(async () => ['::ffff:127.0.0.1']);
    const result = await resolveAndPinPublicUrl('https://mapped.example/hook');
    expect(result.ok).toBe(false);
  });

  it('pins the first public A record', async () => {
    _setSsrfLookup(async () => ['203.0.113.10']);
    // 203.0.113.0/24 is documentation space and blocked — use a real public-looking IP
    _setSsrfLookup(async () => ['8.8.4.4']);
    const result = await resolveAndPinPublicUrl('https://hooks.example.com/aims');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pin.ip).toBe('8.8.4.4');
      expect(result.pin.family).toBe(4);
    }
  });

  it('does not follow a redirect to a private host — caller uses redirect:error', async () => {
    _setSsrfLookup(async (host) => {
      if (host === 'open.example') return ['8.8.8.8'];
      return ['127.0.0.1'];
    });
    const first = await resolveAndPinPublicUrl('https://open.example/start');
    expect(first.ok).toBe(true);
    const bounced = await resolveAndPinPublicUrl('https://127.0.0.1/secret');
    expect(bounced.ok).toBe(false);
  });
});
