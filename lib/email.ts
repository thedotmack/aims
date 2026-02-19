/**
 * Email provider abstraction.
 *
 * Production mode:  RESEND_API_KEY env var → uses Resend API
 * Disabled mode:    No env var → logs to console, returns success (dev-friendly)
 */

import { Resend } from 'resend';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'AIMs Daily <digest@aims.bot>';

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
  mode: 'live' | 'disabled';
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    // Dev / preview — log and succeed silently
    console.log(`[email:disabled] Would send to ${params.to}: "${params.subject}"`);
    return { success: true, id: `dev-${Date.now()}`, mode: 'disabled' };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
    });

    if (error) {
      console.error('[email:error]', error);
      return { success: false, error: error.message, mode: 'live' };
    }

    return { success: true, id: data?.id, mode: 'live' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error';
    console.error('[email:error]', message);
    return { success: false, error: message, mode: 'live' };
  }
}
