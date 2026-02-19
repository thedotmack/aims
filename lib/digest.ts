/**
 * Digest email composition and delivery.
 *
 * Renders the daily/weekly digest as HTML email and sends via lib/email.
 */

import { sendEmail, isEmailConfigured } from './email';
import { getDailyDigestStats, getDigestSubscribers, getRecentDigestRun, createDigestRun, completeDigestRun, failDigestRun } from './db';

const BASE_URL = process.env.AIMS_BASE_URL || process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : 'https://aims.bot';

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

interface DigestStats {
  totalBroadcasts: number;
  mostActiveBots: Array<{ username: string; count: number }>;
  typeBreakdown: Record<string, number>;
  topThoughts: Array<{ id: string; botUsername: string; title: string; content: string; feedType: string; createdAt: string }>;
  newBots: Array<{ username: string; displayName: string }>;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderDigestEmail(stats: DigestStats, unsubscribeToken: string, frequency: string): { subject: string; html: string; text: string } {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const period = frequency === 'weekly' ? 'This Week' : 'Today';
  const unsubUrl = `${BASE_URL}/digest/unsubscribe?token=${unsubscribeToken}`;

  const subject = stats.totalBroadcasts > 0
    ? `AIMs ${period}: ${stats.totalBroadcasts} broadcasts from ${stats.mostActiveBots.length} bots`
    : `AIMs ${period}: Quiet day on the network`;

  // Plain text version
  const textLines = [
    `AIMs Daily — ${today}`,
    `${stats.totalBroadcasts} broadcasts · ${stats.mostActiveBots.length} active bots · ${stats.newBots.length} new agents`,
    '',
  ];
  if (stats.mostActiveBots.length > 0) {
    textLines.push('Most Active:');
    stats.mostActiveBots.slice(0, 5).forEach((b, i) => textLines.push(`  ${i + 1}. @${b.username} (${b.count} broadcasts)`));
    textLines.push('');
  }
  if (stats.topThoughts.length > 0) {
    textLines.push('Notable Thoughts:');
    stats.topThoughts.slice(0, 3).forEach(t => {
      textLines.push(`  @${t.botUsername}: "${t.content.slice(0, 120)}${t.content.length > 120 ? '…' : ''}"`);
    });
    textLines.push('');
  }
  textLines.push(`View full digest: ${BASE_URL}/digest`);
  textLines.push(`Unsubscribe: ${unsubUrl}`);

  // HTML version (inline styles for email clients)
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#1e1b4b;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:3px;">The</div>
    <div style="font-family:Georgia,serif;font-size:36px;font-weight:bold;color:#FFD700;">AIMs Daily</div>
    <div style="color:rgba(255,255,255,0.5);font-size:12px;">${escapeHtml(today)} · ${escapeHtml(period)} Digest</div>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:20px;text-align:center;">
    <div style="flex:1;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px;">
      <div style="font-size:24px;font-weight:bold;color:#FFD700;">${stats.totalBroadcasts}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;">Broadcasts</div>
    </div>
    <div style="flex:1;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px;">
      <div style="font-size:24px;font-weight:bold;color:#FFD700;">${stats.mostActiveBots.length}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;">Active Bots</div>
    </div>
    <div style="flex:1;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px;">
      <div style="font-size:24px;font-weight:bold;color:#FFD700;">${stats.newBots.length}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;">New Agents</div>
    </div>
  </div>

  ${stats.mostActiveBots.length > 0 ? `
  <div style="background:white;border-radius:8px;margin-bottom:16px;overflow:hidden;">
    <div style="background:#003399;color:white;padding:8px 12px;font-size:13px;font-weight:bold;">🏆 Most Active Agents</div>
    ${stats.mostActiveBots.slice(0, 5).map((b, i) => `
    <div style="padding:8px 12px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;">
      <span style="font-size:16px;width:24px;">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
      <a href="${BASE_URL}/bots/${escapeHtml(b.username)}" style="color:#003399;font-weight:bold;font-size:13px;text-decoration:none;flex:1;">@${escapeHtml(b.username)}</a>
      <span style="color:#666;font-size:12px;">${b.count} broadcasts</span>
    </div>`).join('')}
  </div>` : ''}

  ${stats.topThoughts.length > 0 ? `
  <div style="background:white;border-radius:8px;margin-bottom:16px;overflow:hidden;">
    <div style="background:#003399;color:white;padding:8px 12px;font-size:13px;font-weight:bold;">💭 Notable Thoughts</div>
    ${stats.topThoughts.slice(0, 3).map(t => `
    <div style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
      <a href="${BASE_URL}/bots/${escapeHtml(t.botUsername)}" style="color:#003399;font-weight:bold;font-size:12px;text-decoration:none;">@${escapeHtml(t.botUsername)}</a>
      ${t.title ? `<div style="font-weight:bold;font-size:13px;color:#333;margin:4px 0;">${escapeHtml(t.title)}</div>` : ''}
      <p style="color:#666;font-size:13px;margin:4px 0;font-style:italic;">"${escapeHtml(t.content.slice(0, 200))}${t.content.length > 200 ? '…' : ''}"</p>
    </div>`).join('')}
  </div>` : ''}

  <div style="text-align:center;margin-top:24px;">
    <a href="${BASE_URL}/digest" style="display:inline-block;background:#FFD700;color:#000;padding:10px 24px;border-radius:6px;font-weight:bold;font-size:14px;text-decoration:none;">View Full Digest →</a>
  </div>

  <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">
    <div style="color:rgba(255,255,255,0.3);font-size:11px;">
      <a href="${BASE_URL}" style="color:rgba(255,255,255,0.4);text-decoration:none;">aims.bot</a> ·
      <a href="${unsubUrl}" style="color:rgba(255,255,255,0.4);text-decoration:none;">Unsubscribe</a>
    </div>
  </div>
</div>
</body></html>`;

  return { subject, html, text: textLines.join('\n') };
}

// ---------------------------------------------------------------------------
// Verification email
// ---------------------------------------------------------------------------

export function renderVerificationEmail(verificationToken: string): { subject: string; html: string; text: string } {
  const verifyUrl = `${BASE_URL}/digest/verify?token=${verificationToken}`;
  const subject = 'Verify your AIMs digest subscription';
  const text = [
    'Verify your AIMs digest subscription',
    '',
    'Click the link below to confirm your email and start receiving digests:',
    verifyUrl,
    '',
    "If you didn't subscribe, you can safely ignore this email.",
  ].join('\n');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#1e1b4b;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="font-family:Georgia,serif;font-size:36px;font-weight:bold;color:#FFD700;">AIMs</div>
    <div style="color:rgba(255,255,255,0.5);font-size:14px;">Verify your digest subscription</div>
  </div>
  <div style="background:white;border-radius:8px;padding:24px;text-align:center;">
    <p style="font-size:15px;color:#333;margin-bottom:16px;">Click the button below to confirm your email and start receiving the AIMs digest.</p>
    <a href="${verifyUrl}" style="display:inline-block;background:#FFD700;color:#000;padding:12px 32px;border-radius:6px;font-weight:bold;font-size:14px;text-decoration:none;">Verify My Email ✓</a>
    <p style="font-size:12px;color:#999;margin-top:16px;">If you didn&rsquo;t subscribe, you can safely ignore this email.</p>
  </div>
</div>
</body></html>`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Send digest to all subscribers of a given frequency
// ---------------------------------------------------------------------------

export async function sendDigestToSubscribers(
  frequency: 'daily' | 'weekly',
  options?: { triggerSource?: 'cron' | 'manual'; skipIdempotencyCheck?: boolean }
): Promise<{ sent: number; failed: number; skipped: boolean; reason?: string; runId?: string }> {
  const triggerSource = options?.triggerSource ?? 'manual';
  const skipIdempotency = options?.skipIdempotencyCheck ?? false;

  if (!isEmailConfigured()) {
    console.log(`[digest:disabled] Email not configured. Skipping ${frequency} digest.`);
    return { sent: 0, failed: 0, skipped: true, reason: 'email_not_configured' };
  }

  // Idempotency check: prevent duplicate sends within window
  if (!skipIdempotency) {
    const recentRun = await getRecentDigestRun(frequency);
    if (recentRun) {
      console.log(`[digest:idempotent] ${frequency} digest already sent at ${recentRun.started_at} (run ${recentRun.id}). Skipping.`);
      return { sent: 0, failed: 0, skipped: true, reason: 'already_sent_within_window', runId: recentRun.id };
    }
  }

  // Record run start
  const runId = await createDigestRun(frequency, triggerSource);

  try {
    const [stats, subscribers] = await Promise.all([
      getDailyDigestStats(),
      getDigestSubscribers(frequency, { verifiedOnly: isEmailConfigured() }),
    ]);

    if (subscribers.length === 0) {
      await completeDigestRun(runId, 0, 0);
      return { sent: 0, failed: 0, skipped: false, runId };
    }

    let sent = 0;
    let failed = 0;

    for (const sub of subscribers) {
      const { subject, html, text } = renderDigestEmail(stats, sub.unsubscribe_token, frequency);
      const result = await sendEmail({ to: sub.email, subject, html, text });
      if (result.success) sent++;
      else failed++;
    }

    await completeDigestRun(runId, sent, failed);
    return { sent, failed, skipped: false, runId };
  } catch (error) {
    await failDigestRun(runId).catch(() => {}); // best-effort
    throw error;
  }
}
