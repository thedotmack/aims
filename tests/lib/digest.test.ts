import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/email', () => ({
  isEmailConfigured: vi.fn(() => true),
  sendEmail: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('@/lib/db', () => ({
  getDailyDigestStats: vi.fn(() => Promise.resolve({
    totalBroadcasts: 5,
    mostActiveBots: [{ username: 'bot-1', count: 3 }],
    typeBreakdown: { thought: 5 },
    topThoughts: [],
    newBots: [],
  })),
  getDigestSubscribers: vi.fn(() => Promise.resolve([
    { id: '1', email: 'a@test.com', unsubscribe_token: 'tok-a' },
    { id: '2', email: 'b@test.com', unsubscribe_token: 'tok-b' },
  ])),
  getRecentDigestRun: vi.fn(() => Promise.resolve(null)),
  createDigestRun: vi.fn(() => Promise.resolve('run-new')),
  completeDigestRun: vi.fn(() => Promise.resolve()),
  failDigestRun: vi.fn(() => Promise.resolve()),
}));

import { sendDigestToSubscribers } from '@/lib/digest';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { getRecentDigestRun, createDigestRun, completeDigestRun } from '@/lib/db';

describe('sendDigestToSubscribers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isEmailConfigured as any).mockReturnValue(true);
    (getRecentDigestRun as any).mockResolvedValue(null);
    (createDigestRun as any).mockResolvedValue('run-new');
  });

  it('sends to all subscribers and records run', async () => {
    const result = await sendDigestToSubscribers('daily', { triggerSource: 'cron' });
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(false);
    expect(result.runId).toBe('run-new');
    expect(createDigestRun).toHaveBeenCalledWith('daily', 'cron');
    expect(completeDigestRun).toHaveBeenCalledWith('run-new', 2, 0);
  });

  it('skips when already sent within window', async () => {
    (getRecentDigestRun as any).mockResolvedValue({ id: 'prev', started_at: new Date().toISOString(), status: 'completed' });
    const result = await sendDigestToSubscribers('daily');
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already_sent_within_window');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createDigestRun).not.toHaveBeenCalled();
  });

  it('respects skipIdempotencyCheck=true', async () => {
    (getRecentDigestRun as any).mockResolvedValue({ id: 'prev', started_at: new Date().toISOString(), status: 'completed' });
    const result = await sendDigestToSubscribers('daily', { skipIdempotencyCheck: true });
    expect(result.skipped).toBe(false);
    expect(result.sent).toBe(2);
    expect(getRecentDigestRun).not.toHaveBeenCalled();
  });

  it('skips when email not configured', async () => {
    (isEmailConfigured as any).mockReturnValue(false);
    const result = await sendDigestToSubscribers('daily');
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('email_not_configured');
  });

  it('marks run as failed on error', async () => {
    const { failDigestRun } = await import('@/lib/db');
    const { getDailyDigestStats } = await import('@/lib/db');
    (getDailyDigestStats as any).mockRejectedValueOnce(new Error('DB down'));
    await expect(sendDigestToSubscribers('daily')).rejects.toThrow('DB down');
    expect(failDigestRun).toHaveBeenCalledWith('run-new');
  });

  it('defaults triggerSource to manual', async () => {
    await sendDigestToSubscribers('weekly');
    expect(createDigestRun).toHaveBeenCalledWith('weekly', 'manual');
  });
});
