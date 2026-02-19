import { NextRequest } from 'next/server';
import { getDMById, getDMMessages, getTypingIndicators } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId: dmId } = await params;

  const dm = await getDMById(dmId);
  if (!dm) {
    return Response.json({ success: false, error: 'DM not found' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastMessageId = '';
  let lastTypingJson = '[]';
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial state
      try {
        const messages = await getDMMessages(dmId, 50);
        if (messages.length > 0) {
          lastMessageId = messages[messages.length - 1].id; // newest by timestamp (messages returned oldest-first)
          // Actually check: messages are ordered by timestamp ASC, so last = newest
          for (const m of messages) {
            if (m.id > lastMessageId) lastMessageId = m.id;
          }
          lastMessageId = messages[0].id; // They come back ordered, let's track all IDs
        }
        // Track all known message IDs
        const knownIds = new Set(messages.map(m => m.id));
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'init', messages: messages.map(m => ({ id: m.id, sender: m.fromUsername, senderUsername: m.fromUsername, content: m.content, timestamp: new Date(m.timestamp).getTime() })) })}\n\n`));

        const typing = await getTypingIndicators(dmId);
        lastTypingJson = JSON.stringify(typing);
        if (typing.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'typing', users: typing })}\n\n`));
        }

        // Poll for changes
        const poll = async () => {
          if (closed) return;
          try {
            // Check for new messages
            const msgs = await getDMMessages(dmId, 10);
            const newMsgs = msgs.filter(m => !knownIds.has(m.id));
            if (newMsgs.length > 0) {
              for (const m of newMsgs) knownIds.add(m.id);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'messages', messages: newMsgs.map(m => ({ id: m.id, sender: m.fromUsername, senderUsername: m.fromUsername, content: m.content, timestamp: new Date(m.timestamp).getTime() })) })}\n\n`));
            }

            // Check typing state
            const currentTyping = await getTypingIndicators(dmId);
            const currentJson = JSON.stringify(currentTyping);
            if (currentJson !== lastTypingJson) {
              lastTypingJson = currentJson;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'typing', users: currentTyping })}\n\n`));
            }

            // Heartbeat
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch (err) {
            logger.apiError('/api/v1/dms/[roomId]/stream', 'GET-poll', err);
          }
          if (!closed) setTimeout(poll, 2000);
        };

        setTimeout(poll, 2000);

        // Timeout after 5 minutes (Vercel serverless limit)
        setTimeout(() => {
          closed = true;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reconnect' })}\n\n`));
            controller.close();
          } catch { /* already closed */ }
        }, 5 * 60 * 1000);
      } catch (err) {
        logger.apiError('/api/v1/dms/[roomId]/stream', 'GET', err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Service temporarily unavailable' })}\n\n`));
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
