import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before imports
vi.mock('@/lib/email', () => ({
  isEmailConfigured: vi.fn(() => true),
  sendEmail: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('@/lib/db', () => ({
  getDailyDigestStats: vi.fn(() => Promise.resolve({
    totalBroadcasts: 10,
    mostActiveBots: [{ username: 'bot-a', count: 5 }],
    typeBreakdown: { thought: 5, action: 5 },
    topThoughts: [],
    newBots: [],
  })),
  getDigestSubscribers: vi.fn(() => Promise.resolve([
    { id: '1', email: 'a@test.com', unsubscribe_token: 'tok-1' },
  ])),
  getRecentDigestRun: vi.fn(() => Promise.resolve(null)),
  createDigestRun: vi.fn(() => Promise.resolve('run-123')),
  completeDigestRun: vi.fn(() => Promise.resolve()),
  failDigestRun: vi.fn(() => Promise.resolve()),
}));

import { GET } from '@/app/api/v1/digest/cron/route';
import { isEmailConfigured } from '@/lib/email';
import { getRecentDigestRun, createDigestRun } from '@/lib/db';

function makeRequest(opts: { bearer?: string; frequency?: string } = {}) {
  const url = `http://localhost/api/v1/digest/cron?frequency=${opts.frequency || 'daily'}`;
  const headers: Record<string, string> = {};
  if (opts.bearer) headers['authorization'] = `Bearer ${opts.bearer}`;
  const req = new Request(url, { method: 'GET', headers }) as any;
  // Simulate NextRequest.nextUrl
  req.nextUrl = new URL(url);
  return req;
}

describe('GET /api/v1/digest/cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    process.env.AIMS_ADMIN_KEY = 'test-admin-key';
    (isEmailConfigured as any).mockReturnValue(true);
    (getRecentDigestRun as any).mockResolvedValue(null);
    (createDigestRun as any).mockResolvedValue('run-123');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('accepts CRON_SECRET bearer token', async () => {
    const res = await GET(makeRequest({ bearer: 'test-cron-secret' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('accepts AIMS_ADMIN_KEY as fallback', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest({ bearer: 'test-admin-key' }));
    expect(res.status).toBe(200);
  });

  it('returns 503 when email not configured', async () => {
    (isEmailConfigured as any).mockReturnValue(false);
    const res = await GET(makeRequest({ bearer: 'test-cron-secret' }));
    expect(res.status).toBe(503);
  });

  it('skips when already sent within window (returns 200)', async () => {
    (getRecentDigestRun as any).mockResolvedValue({ id: 'prev-run', started_at: new Date().toISOString(), status: 'completed' });
    const res = await GET(makeRequest({ bearer: 'test-cron-secret' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.skipped).toBe(true);
    expect(data.reason).toBe('already_sent_within_window');
  });

  it('passes frequency=weekly from query param', async () => {
    const res = await GET(makeRequest({ bearer: 'test-cron-secret', frequency: 'weekly' }));
    expect(res.status).toBe(200);
    expect(getRecentDigestRun).toHaveBeenCalledWith('weekly');
    expect(createDigestRun).toHaveBeenCalledWith('weekly', 'cron');
  });

  it('defaults to daily frequency', async () => {
    const res = await GET(makeRequest({ bearer: 'test-cron-secret' }));
    expect(res.status).toBe(200);
    expect(createDigestRun).toHaveBeenCalledWith('daily', 'cron');
  });
});
