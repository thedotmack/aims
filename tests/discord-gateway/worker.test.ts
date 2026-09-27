import { EventEmitter } from 'events';
import { afterEach, describe, expect, it } from 'vitest';
import { signAimsEvent as libSign } from '@/lib/discord-hmac';
import { signAimsEvent, buildSignedHeaders } from '../../discord-gateway/src/hmac.mjs';
import { DISCORD_INTENTS, shouldForwardMessage } from '../../discord-gateway/src/filter.mjs';
import { createGatewayWorker } from '../../discord-gateway/src/gateway.mjs';

class FakeSocket extends EventEmitter {
  static OPEN = 1;
  readyState = 1;
  sent: string[] = [];
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.emit('close');
  }
}

describe('discord-gateway worker', () => {
  const sockets: FakeSocket[] = [];
  afterEach(() => {
    sockets.length = 0;
  });

  it('uses intents 513 and forwards only app mentions', () => {
    expect(DISCORD_INTENTS).toBe(513);
    expect(shouldForwardMessage({
      id: '1',
      author: { id: 'human' },
      mentions: [{ id: 'bot' }],
    }, 'bot', 'app')).toBe(true);
    expect(shouldForwardMessage({
      id: '1',
      author: { id: 'human' },
      mentions: [],
    }, 'bot', 'app')).toBe(false);
    expect(shouldForwardMessage({
      id: '1',
      author: { id: 'bot' },
      mentions: [{ id: 'bot' }],
    }, 'bot', 'app')).toBe(false);
  });

  it('HMAC matches the Vercel verifier', () => {
    const raw = '{"type":"MESSAGE_CREATE"}';
    const ts = '1758830000';
    const nonce = 'aabbccddeeff00112233445566778899';
    expect(signAimsEvent('shared-secret', ts, nonce, raw)).toBe(libSign('shared-secret', ts, nonce, raw));
    const headers = buildSignedHeaders('shared-secret', raw, 1_758_830_000);
    expect(headers['x-aims-signature']).toBe(libSign('shared-secret', '1758830000', headers['x-aims-nonce'], raw));
  });

  it('Identifies after Hello, becomes ready, and HMAC-posts a mention Dispatch', async () => {
    const posts: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
    let socket: FakeSocket | null = null;
    const worker = createGatewayWorker({
      token: 'bot-token',
      workerSecret: 'shared-secret',
      eventsUrl: 'https://aims.bot/api/v1/discord/events',
      gatewayUrl: 'ws://fake',
      WebSocketImpl: class extends FakeSocket {
        constructor() {
          super();
          socket = this;
          sockets.push(this);
          queueMicrotask(() => this.emit('open'));
        }
      },
      fetchImpl: async (url: string, init?: RequestInit) => {
        posts.push({
          url: String(url),
          headers: Object.fromEntries(new Headers(init?.headers).entries()),
          body: String(init?.body || ''),
        });
        return new Response(JSON.stringify({ ok: true, wakes: 1 }), { status: 200 });
      },
    });

    worker.start();
    await new Promise((r) => setTimeout(r, 10));
    expect(socket).toBeTruthy();

    worker.handlePacket({ op: 10, d: { heartbeat_interval: 45000 } });
    const identified = JSON.parse(socket!.sent.find((s) => s.includes('"op":2')) || 'null');
    expect(identified.d.intents).toBe(513);
    expect(identified.d.token).toBe('bot-token');

    worker.handlePacket({
      op: 0,
      t: 'READY',
      s: 1,
      d: { session_id: 'sess', user: { id: 'bot' }, application: { id: 'app' } },
    });
    expect(worker.health()).toEqual({ status: 'ok', gateway: 'ready' });

    worker.handlePacket({
      op: 0,
      t: 'MESSAGE_CREATE',
      s: 2,
      d: {
        id: '333',
        channel_id: '222',
        guild_id: '111',
        content: '<@bot> botlord hello',
        author: { id: 'human', username: 'alex' },
        mentions: [{ id: 'bot' }],
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe('https://aims.bot/api/v1/discord/events');
    expect(posts[0].headers['x-aims-signature']).toBeTruthy();
    expect(JSON.parse(posts[0].body).type).toBe('MESSAGE_CREATE');

    worker.handlePacket({
      op: 0,
      t: 'MESSAGE_CREATE',
      s: 3,
      d: {
        id: '334',
        author: { id: 'human' },
        mentions: [],
        content: '',
      },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(posts).toHaveLength(1);

    worker.stop();
  });
});
