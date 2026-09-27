import http from 'node:http';
import { createGatewayWorker } from './gateway.mjs';

const token = process.env.DISCORD_BOT_TOKEN || '';
const workerSecret = process.env.DISCORD_WORKER_SECRET || '';
const eventsUrl = process.env.AIMS_EVENTS_URL || '';
const port = Number(process.env.PORT || 8080);

if (!token) console.error(JSON.stringify({ msg: 'missing_env', name: 'DISCORD_BOT_TOKEN' }));
if (!workerSecret) console.error(JSON.stringify({ msg: 'missing_env', name: 'DISCORD_WORKER_SECRET' }));
if (!eventsUrl) console.error(JSON.stringify({ msg: 'missing_env', name: 'AIMS_EVENTS_URL' }));

const worker = createGatewayWorker({
  token,
  workerSecret,
  eventsUrl,
  gatewayUrl: process.env.DISCORD_GATEWAY_URL,
  botUserId: process.env.DISCORD_BOT_USER_ID || process.env.DISCORD_CLIENT_ID,
});

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    const body = JSON.stringify(worker.health());
    res.writeHead(worker.health().gateway === 'ready' ? 200 : 200, {
      'content-type': 'application/json',
      'cache-control': 'no-cache',
    });
    res.end(body);
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(port, () => {
  console.log(JSON.stringify({ msg: 'health_listen', port }));
  worker.start();
});

function shutdown() {
  worker.stop();
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
