import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const html = await readFile('classroom/index.html', 'utf8');
const bootScript = html.match(/<script data-invite-boot>([^<]+)<\/script>/)?.[1];
if (!bootScript) throw new Error('Missing classroom invite boot script.');
const hash = createHash('sha256').update(bootScript).digest('base64');
const classroomScriptPolicy = [
  "default-src 'none'", "script-src 'self' 'sha256-" + hash + "'",
  "style-src 'self'", "img-src 'self'", "connect-src 'self'",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');

const types = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  svg: 'image/svg+xml',
};
const files = {
  '/': 'dist/index.html',
  '/index.html': 'dist/index.html',
  '/app.js': 'dist/app.js',
  '/art.js': 'dist/art.js',
  '/coach.js': 'dist/coach.js',
  '/lessons.js': 'dist/lessons.js',
  '/logo.svg': 'dist/logo.svg',
  '/style.css': 'dist/style.css',
  '/classroom': 'classroom/index.html',
  '/classroom/': 'classroom/index.html',
  '/classroom/review': 'classroom/index.html',
  '/classroom/app.js': 'classroom/app.js',
  '/classroom/style.css': 'classroom/style.css',
};
const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([url, file]) => [
  url,
  { type: types[file.split('.').at(-1)], content: await readFile(file, 'utf8') },
])));

await build({
  entryPoints: ['worker/index.mjs'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: '.classroom-build/dist/server/index.js',
  legalComments: 'inline',
  plugins: [{
    name: 'embed-game-and-gallery',
    setup(build) {
      build.onResolve({ filter: /^little-pencil-assets$/ }, () => ({ path: 'assets', namespace: 'embedded' }));
      build.onLoad({ filter: /.*/, namespace: 'embedded' }, () => ({
        contents: 'export const assets = ' + JSON.stringify(assets) +
          '; export const classroomScriptPolicy = ' + JSON.stringify(classroomScriptPolicy) + ';',
      }));
    },
  }],
});
