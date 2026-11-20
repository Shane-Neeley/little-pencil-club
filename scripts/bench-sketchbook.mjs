// Compare two local static game directories in an isolated Chrome profile.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
const [base, candidate] = process.argv.slice(2);
if (!base || !candidate) throw Error('Pass the baseline and experiment dist directories.');
const variants = { base:resolve(base), candidate:resolve(candidate) };
const profile = await mkdtemp(join(tmpdir(), 'pencil-sketchbook-chrome-'));
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const match = path.match(/^\/(base|candidate)\/(.*)$/);
  const file = match && !match[2].includes('..') && join(variants[match[1]], match[2] || 'index.html');
  try {
    if (!file) throw Error('Missing');
    const type = {'.js':'text/javascript', '.html':'text/html', '.svg':'image/svg+xml', '.css':'text/css', '.png':'image/png'}[extname(file)];
    response.writeHead(200, {'Content-Type':type || 'application/octet-stream'});
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port;
const executable = process.env.PENCIL_TEST_CHROMIUM_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(executable, [
  '--headless', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--disable-background-networking', '--disable-component-update', '--disable-sync',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', 'about:blank',
], {stdio:'ignore'});

let socket;
try {
  let port;
  for (let attempt = 0; !port && attempt < 80; attempt++) {
    port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(()=> '')).split('\n')[0];
    if (!port) await setTimeout(100);
  }
  assert(port, 'Chrome debugging port');
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, {once:true}));
  const requests = new Map();
  let id = 0;
  socket.addEventListener('message', e => {
    const message = JSON.parse(e.data);
    const pending = requests.get(message.id);
    if (!pending) return;
    requests.delete(message.id);
    if (message.error) pending.reject(Error(message.error.message));
    else pending.resolve(message.result);
  });
  function send(method, params = {}) {
    const pending = Promise.withResolvers();
    requests.set(++id, pending);
    socket.send(JSON.stringify({id, method, params}));
    return pending.promise;
  }
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
    if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
  async function waitFor(expression) {
    for (let attempt = 0; attempt < 50; attempt++) {
      if (await evaluate(expression).catch(() => false)) return;
      await setTimeout(50);
    }
    throw Error('Timed out waiting for ' + expression);
  }
  const boot = async variant => {
    await send('Page.navigate', {url:`${url}/${variant}/#draw/pencil-basics`});
    await waitFor(`location.pathname === '/${variant}/' && document.readyState === 'complete' && Boolean(document.querySelector('#drawing-mode'))`);
    await evaluate(`(() => {
      const originalPaint = paintCard;
      window.bookPaint = { seen:new Set(), count:0, millis:0 };
      paintCard = canvas => {
        const start = performance.now();
        originalPaint(canvas);
        bookPaint.count++;
        bookPaint.seen.add(canvas.dataset.lesson);
        bookPaint.millis += performance.now() - start;
      };
    })()`);
  };
  async function trial(savedCount, strokeCount) {
    return evaluate(`(async () => {
      const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const move = hash => new Promise(resolve => {
        window.addEventListener('hashchange', resolve, {once:true});
        location.hash = hash;
      });
      if (location.hash !== '#draw/pencil-basics') await move('#draw/pencil-basics');
      await settle();
      for (const entry of lessons) localStorage.removeItem('little-pencil-club/' + entry.id);
      for (const [index, entry] of lessons.slice(0, ${savedCount}).entries()) {
        const strokes = Array.from({length:${strokeCount}}, (_, stroke) => ({
          tool: stroke % 5 === 4 ? 'eraser' : 'pencil',
          points: Array.from({length:96}, (_, point) => [
            90 + 8 * point,
            Math.round(100 + stroke * 53 + 60 * Math.sin(point / 9 + stroke + index)),
            15 + (7 * point + index * 3) % 86
          ])
        }));
        localStorage.setItem('little-pencil-club/' + entry.id, JSON.stringify({completed:${savedCount}-index, step:0, strokes, drawingMode:'paper'}));
      }
      drawings.clear();
      Object.assign(bookPaint,{seen:new Set(),count:0,millis:0});
      const start = performance.now();
      await move('#sketchbook');
      const hashMillis = performance.now() - start;
      const beforeFrame = bookPaint.count;
      await settle();
      await settle();
      const firstFrameWindow = performance.now() - start;
      const firstScreenCount = [...document.querySelectorAll('.picture-canvas')].filter(c => {
        const rect=c.getBoundingClientRect();
        return rect.top >= 0 && rect.top < innerHeight;
      }).filter(c => bookPaint.seen.has(c.dataset.lesson)).length;
      return {hashMillis,beforeFrame,firstFrameWindow,firstScreenCount,paints:bookPaint.count,unique:bookPaint.seen.size,paintCPU:bookPaint.millis,cards:document.querySelectorAll('.picture-canvas').length};
    })()`);
  }
  async function pixels() {
    return evaluate(`(async () => {
      const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const capture = [];
      for (const canvas of document.querySelectorAll('.picture-canvas')) {
        canvas.scrollIntoView({block:'center'});
        await frames();
        await frames();
        if (!bookPaint.seen.has(canvas.dataset.lesson)) throw Error('No paint for ' + canvas.dataset.lesson);
        const png = canvas.toDataURL();
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(png));
        capture.push([canvas.dataset.lesson,canvas.width,canvas.height,[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')]);
      }
      return capture;
    })()`);
  }
  const median = values => values.sort((a,b) => a-b)[Math.floor(values.length / 2)];
  const summarize = list => Object.fromEntries(Object.keys(list[0]).map(key => [key, +(median(list.map(sample => sample[key])).toFixed(2))]));
  for (const [label,width,height,scale] of [['phone',390,844,2],['desktop',1280,800,1]]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:scale,mobile:label==='phone'});
    await send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    const pixelResults = {};
    for (const [savedCount, strokeCount] of [[6,3],[24,8],[49,8]]) {
      const samples = {base:[],candidate:[]};
      for (const variant of savedCount % 2 ? ['candidate','base'] : ['base','candidate']) {
        await boot(variant);
        await trial(savedCount,strokeCount);
        for (let repeat=0; repeat<11; repeat++) {
          const sample = await trial(savedCount,strokeCount);
          assert.equal(sample.cards,savedCount);
          assert(sample.firstScreenCount > 0);
          samples[variant].push(sample);
        }
        if (savedCount === 49) pixelResults[variant] = await pixels();
      }
      const before = summarize(samples.base), after = summarize(samples.candidate);
      console.log(JSON.stringify({label,savedCount,strokeCount,samples:11,before,after,routeSpeedup:+(before.hashMillis/after.hashMillis).toFixed(2)}));
    }
    assert.deepEqual(pixelResults.candidate,pixelResults.base);
    console.log(`${label}: ${pixelResults.base.length} visible thumbnails matched PNG hashes and sizes`);
  }
} finally {
  socket?.close();
  if (chrome.pid && chrome.exitCode === null && chrome.signalCode === null) {
    const exited = once(chrome, 'exit');
    chrome.kill();
    await exited;
  }
  server.close();
  await rm(profile, {recursive:true, force:true});
}
