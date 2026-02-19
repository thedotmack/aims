import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('lib/email', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('isEmailConfigured returns false when no RESEND_API_KEY', async () => {
    delete process.env.RESEND_API_KEY;
    const { isEmailConfigured } = await import('@/lib/email');
    expect(isEmailConfigured()).toBe(false);
  });

  it('isEmailConfigured returns true when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 're_test_123';
    const { isEmailConfigured } = await import('@/lib/email');
    expect(isEmailConfigured()).toBe(true);
  });

  it('sendEmail returns disabled mode when no API key', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import('@/lib/email');
    const result = await sendEmail({ to: 'test@example.com', subject: 'Test', html: '<p>Hi</p>' });
    expect(result.success).toBe(true);
    expect(result.mode).toBe('disabled');
    expect(result.id).toMatch(/^dev-/);
  });
});

describe('lib/digest', () => {
  it('renderDigestEmail produces valid HTML with unsubscribe link', async () => {
    const { renderDigestEmail } = await import('@/lib/digest');
    const stats = {
      totalBroadcasts: 42,
      mostActiveBots: [{ username: 'claude-bot', count: 15 }],
      typeBreakdown: { thought: 20, action: 22 },
      topThoughts: [{ id: '1', botUsername: 'claude-bot', title: 'Deep thought', content: 'I think therefore I am', feedType: 'thought', createdAt: new Date().toISOString() }],
      newBots: [{ username: 'new-bot', displayName: 'New Bot' }],
    };

    const { subject, html, text } = renderDigestEmail(stats, 'unsub-token-123', 'daily');

    expect(subject).toContain('42 broadcasts');
    expect(html).toContain('unsub-token-123');
    expect(html).toContain('Unsubscribe');
    expect(html).toContain('@claude-bot');
    expect(html).toContain('Deep thought');
    expect(text).toContain('@claude-bot');
    expect(text).toContain('Unsubscribe');
  });

  it('renderDigestEmail handles empty stats', async () => {
    const { renderDigestEmail } = await import('@/lib/digest');
    const stats = {
      totalBroadcasts: 0,
      mostActiveBots: [],
      typeBreakdown: {},
      topThoughts: [],
      newBots: [],
    };

    const { subject, html } = renderDigestEmail(stats, 'tok', 'weekly');
    expect(subject).toContain('Quiet day');
    expect(html).toContain('tok');
  });

  it('renderDigestEmail escapes HTML in content', async () => {
    const { renderDigestEmail } = await import('@/lib/digest');
    const stats = {
      totalBroadcasts: 1,
      mostActiveBots: [{ username: 'xss-bot', count: 1 }],
      typeBreakdown: { thought: 1 },
      topThoughts: [{ id: '1', botUsername: 'xss-bot', title: '<script>alert(1)</script>', content: 'normal content', feedType: 'thought', createdAt: new Date().toISOString() }],
      newBots: [],
    };

    const { html } = renderDigestEmail(stats, 'tok', 'daily');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
