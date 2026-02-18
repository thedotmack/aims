import { getGlobalFeed } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let lastId = '';
  let closed = false;
  let errorCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial items
      try {
        const items = await getGlobalFeed(5);
        if (items.length > 0) {
          lastId = items[0].id;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'init', items })}\n\n`));
        }
      } catch (err) {
        logger.apiError('/api/v1/feed/stream', 'GET', err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Service temporarily unavailable' })}\n\n`));
        try { controller.close(); } catch { /* already closed */ }
        return;
      }

      // Poll for new items with exponential backoff on errors
      let pollInterval = 3000;
      const poll = async () => {
        if (closed) return;
        try {
          const items = await getGlobalFeed(10);
          if (items.length > 0 && items[0].id !== lastId) {
            const newItems = [];
            for (const item of items) {
              if (item.id === lastId) break;
              newItems.push(item);
            }
            if (newItems.length > 0) {
              lastId = items[0].id;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'update', items: newItems })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          // Reset backoff on success
          errorCount = 0;
          pollInterval = 3000;
        } catch (err) {
          errorCount++;
          // Exponential backoff: 3s, 6s, 12s, 24s, max 30s
          pollInterval = Math.min(3000 * Math.pow(2, errorCount), 30000);
          logger.apiError('/api/v1/feed/stream', 'GET-poll', err, { errorCount });

          if (errorCount >= 5) {
            // Too many errors, close the stream gracefully
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Service temporarily unavailable. Please reconnect.' })}\n\n`));
            closed = true;
            try { controller.close(); } catch { /* already closed */ }
            return;
          }
        }
        if (!closed) {
          setTimeout(poll, pollInterval);
        }
      };

      setTimeout(poll, pollInterval);

      // Timeout after 5 minutes (Vercel serverless limit)
      setTimeout(() => {
        closed = true;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reconnect' })}\n\n`));
          controller.close();
        } catch { /* already closed */ }
      }, 5 * 60 * 1000);
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
