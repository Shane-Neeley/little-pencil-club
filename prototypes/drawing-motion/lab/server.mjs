import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const fixture = await readFile(new URL('../jellyfish.png', import.meta.url));
const mockGif = await readFile(new URL('./fixture-motion.gif', import.meta.url));
const presets = new Set(['wiggle', 'bounce']);
export const GIF_LIMIT = 2_000_000;
const requestedGifFrames = 6;
const labPanel = await readFile(new URL('./panel.html', import.meta.url), 'utf8');
const demo = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const page = demo.replace('</main>', `${labPanel}\n</main>`).replace(
  '</head>',
  '<link rel="stylesheet" href="./lab.css">\n<script defer src="./lab.js"></script>\n</head>',
);
const files = new Map([
  ['/', ['text/html; charset=utf-8', page]],
  ['/motion.css', ['text/css; charset=utf-8', await readFile(new URL('../motion.css', import.meta.url))]],
  ['/motion.js', ['text/javascript; charset=utf-8', await readFile(new URL('../motion.js', import.meta.url))]],
  ['/lab.css', ['text/css; charset=utf-8', await readFile(new URL('./lab.css', import.meta.url))]],
  ['/lab.js', ['text/javascript; charset=utf-8', await readFile(new URL('./lab.js', import.meta.url))]],
  ['/jellyfish.png', ['image/png', fixture]],
]);

function presetRequest() {
  const body = {
    model: 'gpt-6-luna',
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Choose one gentle motion that fits this original synthetic drawing.' },
        { type: 'input_image', image_url: `data:image/png;base64,${fixture.toString('base64')}` },
      ],
    }],
    questions: [{
      type: 'choice',
      name: 'motion',
      instructions: 'Choose wiggle for a gentle side-to-side tilt or bounce for an up-and-down jump.',
      choices: [...presets].map(value => ({ value, description: value === 'wiggle' ? 'Side-to-side tilt' : 'Up-and-down jump' })),
    }],
  };
  return { path: '/v1/decisions', body };
}

function gifRequest() {
  const body = new FormData();
  body.set('model', 'gpt-image-2.6-flare');
  body.set('image[]', new Blob([fixture], { type: 'image/png' }), 'jellyfish.png');
  body.set('prompt', 'Make this synthetic jellyfish gently tilt side to side and return to its first pose. Keep the original outline, face, tentacles, and pencil colors recognizable. Keep the background simple and the whole drawing in frame.');
  body.set('quality', 'low');
  body.set('moderation', 'auto');
  body.set('size', 'auto');
  body.set('n', '1');
  body.set('output_format', 'gif');
  body.set('frame_count', String(requestedGifFrames));
  body.set('frame_duration_ms', '240');
  return { path: '/v1/images/edits', body };
}

async function mockTransport({ path }) {
  if (path === '/v1/decisions') {
    return { answers: [{ type: 'choice', name: 'motion', choice: 'wiggle' }] };
  }
  return { data: [{ b64_json: mockGif.toString('base64') }] };
}

function validateGif(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(GIF_LIMIT / 3) * 4) return false;
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length < 30 || bytes.length > GIF_LIMIT || bytes.toString('base64') !== value) return false;
  if (!['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)) || bytes.at(-1) !== 0x3b) return false;
  const [width, height] = [bytes.readUInt16LE(6), bytes.readUInt16LE(8)];
  return width > 0 && height > 0 && width <= 2048 && height <= 2048
    && hasRequestedFrames(bytes, width, height);
}

// Walk palettes, extensions, and image data sub-blocks before accepting the GIF.
// This validates structure and frame count. A decoder is still needed for fidelity checks.
function hasRequestedFrames(bytes, canvasWidth, canvasHeight) {
  const paletteBytes = flags => flags & 0x80 ? 3 * (2 << (flags & 7)) : 0;
  let offset = 13 + paletteBytes(bytes[10]);
  let frames = 0;

  while (offset < bytes.length) {
    const block = bytes[offset++];
    if (block === 0x3b) return offset === bytes.length && frames === requestedGifFrames;
    if (block === 0x21) {
      offset++; // Extension label.
    } else if (block === 0x2c) {
      if (offset + 9 > bytes.length) return false;
      const left = bytes.readUInt16LE(offset);
      const top = bytes.readUInt16LE(offset + 2);
      const width = bytes.readUInt16LE(offset + 4);
      const height = bytes.readUInt16LE(offset + 6);
      if (!width || !height || left + width > canvasWidth || top + height > canvasHeight) return false;
      offset += 9 + paletteBytes(bytes[offset + 8]);
      const codeSize = bytes[offset++];
      if (codeSize < 2 || codeSize > 8 || !bytes[offset] || ++frames > requestedGifFrames) return false;
    } else {
      return false;
    }

    while (offset < bytes.length && bytes[offset] !== 0) offset += bytes[offset] + 1;
    if (offset >= bytes.length) return false;
    offset++; // End of sub-blocks.
  }
  return false;
}

export async function preview(kind, transport = mockTransport, timeoutMs = 1200) {
  const fallback = { kind: 'local' };
  if (kind !== 'preset' && kind !== 'gif') return fallback;
  const controller = new AbortController();
  let timer;
  try {
    const request = kind === 'preset' ? presetRequest() : gifRequest();
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Preview timed out'));
        controller.abort();
      }, timeoutMs);
    });
    const answer = await Promise.race([transport(request, { signal: controller.signal }), timeout]);
    if (kind === 'preset') {
      const choice = answer?.answers?.[0];
      return Array.isArray(answer?.answers) && answer.answers.length === 1
        && choice?.type === 'choice' && choice.name === 'motion' && presets.has(choice.choice)
        ? { kind, preset: choice.choice }
        : fallback;
    }
    const gif = answer?.data?.[0]?.b64_json;
    return Array.isArray(answer?.data) && answer.data.length === 1 && validateGif(gif) ? { kind, gif } : fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

export function createMotionLab() {
  const server = createServer(async (request, response) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const host = origin.slice('http://'.length);
    if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== origin)) {
      response.writeHead(403).end();
      return;
    }

    const file = request.method === 'GET' && files.get(request.url);
    if (file) {
      response.writeHead(200, {
        'Content-Type': file[0],
        'Content-Security-Policy': "default-src 'self'; img-src 'self' blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      }).end(file[1]);
      return;
    }

    if (request.method === 'POST' && ['/preview/preset', '/preview/gif'].includes(request.url)) {
      if (Number(request.headers['content-length']) > 0 || request.headers['transfer-encoding']) {
        response.writeHead(400).end();
        return;
      }
      const result = await preview(request.url.split('/').at(-1));
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      }).end(JSON.stringify(result));
      return;
    }

    response.writeHead(404).end();
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createMotionLab();
  server.listen(0, '127.0.0.1', () => {
    process.stdout.write(`Mock motion lab at http://127.0.0.1:${server.address().port}/\n`);
  });
}
