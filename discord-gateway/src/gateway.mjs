import { WebSocket } from 'ws';
import { buildSignedHeaders } from './hmac.mjs';
import { DISCORD_INTENTS, shouldForwardMessage } from './filter.mjs';

export function createGatewayWorker(opts) {
  const token = opts.token || '';
  const secret = opts.workerSecret || '';
  const eventsUrl = opts.eventsUrl || '';
  const gatewayUrl = opts.gatewayUrl || 'wss://gateway.discord.gg/?v=10&encoding=json';
  const fetchImpl = opts.fetchImpl || globalThis.fetch.bind(globalThis);
  const WebSocketImpl = opts.WebSocketImpl || WebSocket;

  let ws = null;
  let heartbeatTimer = null;
  let heartbeatInterval = 0;
  let seq = null;
  let sessionId = null;
  let botUserId = opts.botUserId || '';
  let appId = opts.appId || '';
  let gatewayState = 'connecting';
  let stopped = false;
  let resumeOnOpen = false;
  let identifySent = false;

  function clearHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function log(message, extra) {
    if (extra) console.log(JSON.stringify({ msg: message, ...extra }));
    else console.log(JSON.stringify({ msg: message }));
  }

  async function forward(message) {
    if (!secret || !eventsUrl) return;
    const rawBody = JSON.stringify({ type: 'MESSAGE_CREATE', message });
    const headers = buildSignedHeaders(secret, rawBody);
    try {
      const res = await fetchImpl(eventsUrl, { method: 'POST', headers, body: rawBody });
      if (!res.ok) log('events_post_failed', { status: res.status });
    } catch {
      log('events_post_error');
    }
  }

  function send(payload) {
    if (ws && ws.readyState === WebSocketImpl.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function identify() {
    if (identifySent) return;
    identifySent = true;
    send({
      op: 2,
      d: {
        token,
        intents: DISCORD_INTENTS,
        properties: { os: 'linux', browser: 'aims', device: 'aims-gateway' },
      },
    });
  }

  function resume() {
    send({
      op: 6,
      d: { token, session_id: sessionId, seq },
    });
  }

  function startHeartbeat(interval) {
    clearHeartbeat();
    heartbeatInterval = interval;
    heartbeatTimer = setInterval(() => {
      send({ op: 1, d: seq });
    }, interval);
  }

  function handlePacket(packet) {
    if (packet.s != null) seq = packet.s;
    if (packet.op === 10) {
      startHeartbeat(packet.d.heartbeat_interval);
      if (resumeOnOpen && sessionId != null && seq != null) resume();
      else identify();
      return;
    }
    if (packet.op === 11) return;
    if (packet.op === 7) {
      resumeOnOpen = Boolean(sessionId);
      reconnect();
      return;
    }
    if (packet.op === 9) {
      sessionId = null;
      resumeOnOpen = false;
      identifySent = false;
      reconnect(1000);
      return;
    }
    if (packet.op === 0 && packet.t === 'READY') {
      sessionId = packet.d?.session_id || sessionId;
      botUserId = packet.d?.user?.id || botUserId;
      appId = packet.d?.application?.id || appId || botUserId;
      gatewayState = 'ready';
      log('gateway_ready');
      return;
    }
    if (packet.op === 0 && packet.t === 'RESUMED') {
      gatewayState = 'ready';
      log('gateway_resumed');
      return;
    }
    if (packet.op === 0 && packet.t === 'MESSAGE_CREATE') {
      const message = packet.d;
      if (shouldForwardMessage(message, botUserId, appId)) {
        void forward(message);
      }
    }
  }

  function connect() {
    if (stopped) return;
    gatewayState = sessionId ? 'connecting' : 'connecting';
    identifySent = false;
    ws = new WebSocketImpl(gatewayUrl);
    ws.on('open', () => {
      log('gateway_socket_open');
    });
    ws.on('message', (data) => {
      try {
        handlePacket(JSON.parse(String(data)));
      } catch {
        log('gateway_bad_packet');
      }
    });
    ws.on('close', () => {
      clearHeartbeat();
      if (!stopped) {
        resumeOnOpen = Boolean(sessionId);
        reconnect(1500);
      }
    });
    ws.on('error', () => {
      log('gateway_socket_error');
    });
  }

  let reconnectTimer = null;
  function reconnect(delay = 1500) {
    if (stopped) return;
    if (reconnectTimer) return;
    gatewayState = 'connecting';
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  return {
    start() {
      stopped = false;
      connect();
    },
    stop() {
      stopped = true;
      clearHeartbeat();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      if (ws) {
        try { ws.close(); } catch { /* ignore */ }
        ws = null;
      }
      gatewayState = 'connecting';
    },
    health() {
      return { status: gatewayState === 'ready' ? 'ok' : 'starting', gateway: gatewayState };
    },
    getState() {
      return { gatewayState, botUserId, sessionId, seq };
    },
    handlePacket,
  };
}
