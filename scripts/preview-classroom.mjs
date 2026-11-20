
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { parseArgs } from 'node:util';
import './build-classroom.mjs';
import { initLocalDatabase, localOwnerId, localWorker } from './local-classroom.mjs';

const { values } = parseArgs({ options: {
  host: { type: 'string', default: '127.0.0.1' },
  port: { type: 'string' },
  strictPort: { type: 'boolean' },
} });
const port = Number(values.port || process.env.PORT || 8787);
if (values.host !== '127.0.0.1' || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Use a valid port and the loopback address 127.0.0.1.');
}
const privateKey = process.env.CLASSROOM_PREVIEW_OWNER_KEY;
if (privateKey && privateKey.length < 32) throw new Error('Use a local adult key of at least 32 characters.');
const expectedAuth = privateKey ? Buffer.from('Basic ' + Buffer.from('adult:' + privateKey).toString('base64')) : null;
const worker = localWorker('.classroom-preview');
await initLocalDatabase(await worker.getD1Database('DB'));

function isOwner(request) {
  const supplied = Buffer.from(request.headers.authorization || '');
  return expectedAuth && supplied.length === expectedAuth.length && timingSafeEqual(supplied, expectedAuth);
}

const server = createServer(async (request, response) => {
  try {
    // Only the localhost proxy can supply profile headers to the Worker.
    const headers = new Headers(request.headers);
    headers.delete('oai-authenticated-user-id');
    headers.delete('authorization');
    const localHost = request.headers.host;
    const permitted = new Set(['127.0.0.1:' + port, 'localhost:' + port, 'terminal.local:' + port, 'terminal.local']);
    if (!permitted.has(localHost) || !request.url?.startsWith('/') || request.url.startsWith('//')) {
      response.writeHead(400).end();
      return;
    }

    const url = new URL(request.url, 'http://' + localHost);
    if (url.host !== localHost) {
      response.writeHead(400).end();
      return;
    }
    const owner = isOwner(request);
    if (url.pathname === '/signin-with-chatgpt') {
      if (!privateKey) {
        response.writeHead(503, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' })
          .end('Local adult controls require CLASSROOM_PREVIEW_OWNER_KEY before starting the preview.');
      } else if (owner) {
        response.writeHead(303, { Location: '/classroom/review', 'Cache-Control': 'no-store' }).end();
      } else {
        response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Little Pencil Club localhost preview"',
          'Cache-Control': 'no-store' }).end();
      }
      return;
    }
    if (owner) headers.set('oai-authenticated-user-id', localOwnerId);

    const hasBody = Number(request.headers['content-length']) > 0 || Boolean(request.headers['transfer-encoding']);
    const result = await worker.dispatchFetch(url.href, {
      method: request.method, headers,
      ...(hasBody ? { body: Readable.toWeb(request), duplex: 'half' } : {}),
    });
    response.writeHead(result.status, Object.fromEntries(result.headers));
    if (result.body) await pipeline(Readable.fromWeb(result.body), response);
    else response.end();
  } catch {
    if (!response.headersSent) response.writeHead(503);
    response.end();
  }
});
server.listen(port, '127.0.0.1', () => console.log('Little Pencil Club local preview on port ' + port));
async function shutdown() {
  server.closeAllConnections();
  server.close();
  await worker.dispose();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
