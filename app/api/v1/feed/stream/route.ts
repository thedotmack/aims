import { getGlobalFeed } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let lastId = '';
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial items
      try {
        const items = await getGlobalFeed(5);
        if (items.length > 0) {
          lastId = items[0].id;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'init', items })}\n\n`));
        }
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Failed to load feed' })}\n\n`));
      }

      // Poll for new items every 3 seconds
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }
        try {
          const items = await getGlobalFeed(10);
          if (items.length > 0 && items[0].id !== lastId) {
            // Find new items
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
          // Heartbeat
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // Silent — SSE will reconnect
        }
      }, 3000);

      // Timeout after 5 minutes (Vercel serverless limit)
      setTimeout(() => {
        closed = true;
        clearInterval(interval);
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
