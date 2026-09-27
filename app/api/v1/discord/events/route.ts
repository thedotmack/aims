import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { originFromRequest } from '@/lib/contact-pages';
import { verifyAimsEventSignature } from '@/lib/discord-hmac';
import { discordWorkerSecret } from '@/lib/discord';
import { processDiscordMessageCreate, reserveDiscordDelivery } from '@/lib/discord-events';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const timestamp = request.headers.get('x-aims-timestamp') || '';
    const nonce = request.headers.get('x-aims-nonce') || '';
    const signature = request.headers.get('x-aims-signature') || '';

    const verified = verifyAimsEventSignature({
      secret: discordWorkerSecret(),
      timestamp,
      nonce,
      signature,
      rawBody,
    });
    if (!verified.ok) {
      return Response.json({ success: false, error: verified.error }, { status: 401 });
    }

    let body: { type?: string; message?: Record<string, unknown>; hop?: unknown };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      return Response.json({ success: false, error: 'invalid_json' }, { status: 400 });
    }

    if (body.type && body.type !== 'MESSAGE_CREATE') {
      return Response.json({ ok: true, ignored: 'not_message_create' });
    }

    const message = (body.message || {}) as {
      id?: string;
      channel_id?: string;
      guild_id?: string;
      content?: string;
      author?: { id?: string; username?: string; application_id?: string };
      mentions?: Array<{ id?: string }>;
      message_reference?: { message_id?: string };
      thread?: { id?: string };
    };

    const reserved = await reserveDiscordDelivery(nonce, message.id || null);
    if (!reserved.ok) {
      return Response.json({ success: false, error: reserved.reason === 'message' ? 'duplicate_message' : 'nonce_reuse' }, { status: 401 });
    }

    const result = await processDiscordMessageCreate(message, { origin: originFromRequest(request) });
    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }
    if (result.wakes === 0) {
      return Response.json({ ok: true, ignored: result.ignored });
    }
    return Response.json({ ok: true, wakes: 1 });
  } catch (err) {
    return handleApiError(err, '/api/v1/discord/events', 'POST');
  }
}
