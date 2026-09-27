import { isIP } from 'node:net';
import dns from 'node:dns/promises';

export type PinnedAddress = { ip: string; family: 4 | 6 };

export type LookupFn = (hostname: string) => Promise<string[]>;

let lookupImpl: LookupFn | null = null;

/** Test-only: replace DNS resolution. Pass null to restore the default resolver. */
export function _setSsrfLookup(fn: LookupFn | null): void {
  lookupImpl = fn;
}

function ipToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function inCidr(ip: string, base: string, bits: number): boolean {
  const a = ipToInt(ip);
  const b = ipToInt(base);
  if (a == null || b == null) return false;
  const mask = bits === 0 ? 0 : (~((1 << (32 - bits)) - 1)) >>> 0;
  return ((a >>> 0) & mask) === ((b >>> 0) & mask);
}

function expandIpv6(ip: string): string | null {
  let addr = ip.toLowerCase();
  if (addr.startsWith('[') && addr.endsWith(']')) addr = addr.slice(1, -1);
  if (addr.includes('.')) {
    const mapped = addr.match(/^(?:0:)+ffff:(\d+\.\d+\.\d+\.\d+)$/i) || addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped) return `::ffff:${mapped[1]}`;
  }
  const sides = addr.split('::');
  if (sides.length > 2) return null;
  const head = sides[0] ? sides[0].split(':') : [];
  const tail = sides[1] ? sides[1].split(':') : [];
  if (addr.includes('::')) {
    const missing = 8 - (head.filter(Boolean).length + tail.filter(Boolean).length);
    if (missing < 0) return null;
    const mid = Array.from({ length: missing }, () => '0');
    const parts = [...head.filter(Boolean), ...mid, ...tail.filter(Boolean)];
    if (parts.length !== 8) return null;
    return parts.map((p) => p.padStart(4, '0')).join(':');
  }
  const parts = addr.split(':');
  if (parts.length !== 8) return null;
  return parts.map((p) => p.padStart(4, '0')).join(':');
}

function ipv4FromMapped(expanded: string): string | null {
  if (!expanded.startsWith('0000:0000:0000:0000:0000:ffff:')) {
    const compact = expanded.replace(/:/g, '');
    if (expanded.startsWith('0000:0000:0000:0000:0000:ffff:')) return null;
    void compact;
  }
  const m = expanded.match(/^0000:0000:0000:0000:0000:ffff:([0-9a-f]{4}):([0-9a-f]{4})$/);
  if (!m) return null;
  const hi = parseInt(m[1], 16);
  const lo = parseInt(m[2], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

export function isBlockedIpv4(ip: string): boolean {
  if (
    inCidr(ip, '0.0.0.0', 8) ||
    inCidr(ip, '10.0.0.0', 8) ||
    inCidr(ip, '127.0.0.0', 8) ||
    inCidr(ip, '169.254.0.0', 16) ||
    inCidr(ip, '172.16.0.0', 12) ||
    inCidr(ip, '192.168.0.0', 16) ||
    inCidr(ip, '100.64.0.0', 10) ||
    inCidr(ip, '192.0.0.0', 24) ||
    inCidr(ip, '192.0.2.0', 24) ||
    inCidr(ip, '198.51.100.0', 24) ||
    inCidr(ip, '203.0.113.0', 24) ||
    inCidr(ip, '198.18.0.0', 15) ||
    inCidr(ip, '224.0.0.0', 4) ||
    inCidr(ip, '240.0.0.0', 4)
  ) {
    return true;
  }
  return ip === '255.255.255.255';
}

export function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
  const dottedMapped = lower.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dottedMapped) return isBlockedIpv4(dottedMapped[1]);
  const expanded = expandIpv6(ip);
  if (!expanded) return true;
  const mapped = ipv4FromMapped(expanded);
  if (mapped) return isBlockedIpv4(mapped);
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0000') return true;
  const first = parseInt(expanded.slice(0, 4), 16);
  // fe80::/10 link-local, fc00::/7 ULA (includes fd00::), ff00::/8 multicast, 2001:db8::/32 docs
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xff00) === 0xff00) return true;
  if (first === 0x2001 && parseInt(expanded.slice(5, 9), 16) === 0x0db8) return true;
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  if (ip.startsWith('[') && ip.endsWith(']')) return isBlockedIp(ip.slice(1, -1));
  return true;
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.com',
  'metadata',
]);

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host.endsWith('.localhost.') || host === '0.0.0.0') return true;
  return false;
}

async function defaultLookup(hostname: string): Promise<string[]> {
  const ips = new Set<string>();
  const results = await Promise.allSettled([
    dns.resolve4(hostname),
    dns.resolve6(hostname),
  ]);
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const ip of result.value) ips.add(ip);
    }
  }
  if (ips.size === 0) {
    const looked = await dns.lookup(hostname, { all: true, verbatim: true });
    for (const row of looked) ips.add(row.address);
  }
  return [...ips];
}

export async function resolveHostIps(hostname: string): Promise<string[]> {
  const fn = lookupImpl || defaultLookup;
  return fn(hostname);
}

export type PinResult =
  | { ok: true; pin: PinnedAddress; url: string }
  | { ok: false; error: string };

/**
 * Resolve A/AAAA immediately, reject if any answer is private/special-use,
 * and return the first public address to pin for the upcoming connect.
 */
export async function resolveAndPinPublicUrl(raw: string): Promise<PinResult> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: 'webhookUrl must be a valid URL' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'webhookUrl must use http or https' };
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isBlockedHostname(host)) {
    return { ok: false, error: 'webhookUrl cannot point at a private or internal host' };
  }

  const version = isIP(host);
  if (version) {
    if (isBlockedIp(host)) {
      return { ok: false, error: 'webhookUrl cannot point at a private or internal host' };
    }
    return { ok: true, pin: { ip: host, family: version as 4 | 6 }, url: parsed.toString() };
  }

  let ips: string[];
  try {
    ips = await resolveHostIps(host);
  } catch {
    return { ok: false, error: 'webhookUrl host could not be resolved' };
  }

  if (ips.length === 0) {
    return { ok: false, error: 'webhookUrl host could not be resolved' };
  }

  if (ips.some((ip) => isBlockedIp(ip))) {
    return { ok: false, error: 'webhookUrl resolved to a private or internal address' };
  }

  const first = ips[0];
  const family = (isIP(first) || 4) as 4 | 6;
  return { ok: true, pin: { ip: first, family: family === 6 ? 6 : 4 }, url: parsed.toString() };
}

export async function pinnedFetch(
  url: string,
  init: RequestInit,
  pin: PinnedAddress
): Promise<Response> {
  const { Agent, fetch: undiciFetch } = await import('undici');
  const agent = new Agent({
    connect: {
      lookup(_hostname, _options, callback) {
        callback(null, pin.ip, pin.family);
      },
    },
  });
  return undiciFetch(url, {
    ...init,
    redirect: 'error',
    dispatcher: agent,
  } as Parameters<typeof undiciFetch>[1]) as unknown as Promise<Response>;
}
