import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { before, beforeEach, after, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { activateDemo } from '../demo/demo.mjs';
import worker from '../src/worker.mjs';

const deps = process.env.PROGRESS_TEST_DEPS;
if (!deps) throw new Error('Set PROGRESS_TEST_DEPS to the directory containing the test dependencies.');
const require = createRequire(join(deps, 'package.json'));
const { Miniflare } = require('miniflare');
const { JSDOM } = require('jsdom');
const chromiumPath = process.env.PROGRESS_TEST_CHROMIUM;
const browserRequired = { skip: chromiumPath ? false : 'Set PROGRESS_TEST_CHROMIUM to run browser checks.' };
const root = new URL('../', import.meta.url);
const origin = 'https://progress-prototype.test';
const gameOrigin = 'https://little-pencil-fixture.test';
const api = '/progress-backup/v1/';
const unrelatedDrawingKey = 'little-pencil-club/progress-fixture-drawing';
const localKey = 'little-pencil-club/progress-backup-prototype';
const saveBody = { version: 1, completed: ['sample-fox'] };
const enabledBindings = { PROGRESS_BACKUP_ENABLED: 'true' };
let mf;
let db;
let browser;

before(async () => {
  mf = new Miniflare({
    modules: true,
    modulesRoot: fileURLToPath(new URL('src/', root)),
    scriptPath: fileURLToPath(new URL('src/worker.mjs', root)),
    compatibilityDate: '2026-07-30',
    bindings: enabledBindings,
    d1Databases: { PROGRESS_DB: 'progress-prototype' },
    d1Persist: false,
    logRequests: false,
    unsafeTriggerHandlers: true,
  });
  db = await mf.getD1Database('PROGRESS_DB');
  const migration = await readFile(new URL('migrations/0001_progress.sql', root), 'utf8');
  await db.batch(migration.split(';').map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
});

beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM progress_backups'),
    db.prepare('DELETE FROM progress_request_limits'),
  ]);
});

after(async () => {
  await browser?.close();
  await mf?.dispose();
});

function request(action, body, options = {}) {
  const { path = api + action, method = 'POST', headers = {}, raw } = options;
  return mf.dispatchFetch(origin + path, {
    method,
    headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: method === 'GET' ? undefined : raw ?? JSON.stringify(body),
  });
}

function workerRequest(action, body) {
  return new Request(origin + api + action, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function saveCode(body = saveBody) {
  const result = await request('save', body);
  assert.equal(result.status, 201);
  return result.json();
}

async function assertUnavailable(response) {
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Backup unavailable.' });
  assert.match(response.headers.get('Cache-Control'), /no-store/);
}

async function getBrowser() {
  if (!browser) {
    const { chromium } = require('playwright-core');
    browser = await chromium.launch({ executablePath: chromiumPath });
  }
  return browser;
}

async function countBackups() {
  return db.prepare('SELECT count(*) AS count FROM progress_backups').first('count');
}

const demoFiles = new Map([
  ['/', ['demo/index.html', 'text/html']],
  ['/demo/demo.mjs', ['demo/demo.mjs', 'text/javascript']],
  ['/src/lessons.mjs', ['src/lessons.mjs', 'text/javascript']],
]);

async function demoHtml(enabled) {
  const html = await readFile(new URL('demo/index.html', root), 'utf8');
  return enabled ? html.replace('<html lang="en">', '<html lang="en" data-progress-backup="enabled">') : html;
}

async function newDevice(t) {
  const context = await (await getBrowser()).newContext({ serviceWorkers: 'block' });
  t.after(() => context.close());
  let offline = false;
  await context.route('**/*', async route => {
    const incoming = route.request();
    assert.equal(new URL(incoming.url()).origin, origin);
    const path = new URL(incoming.url()).pathname;
    if (path.startsWith(api)) {
      if (offline) return route.abort('internetdisconnected');
      const response = await mf.dispatchFetch(incoming.url(), {
        method: incoming.method(),
        headers: await incoming.allHeaders(),
        body: incoming.postDataBuffer(),
      });
      return route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: Buffer.from(await response.arrayBuffer()),
      });
    }
    const file = demoFiles.get(path);
    if (!file) return route.fulfill({ status: 404 });
    return route.fulfill({
      contentType: file[1],
      headers: {
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        'Referrer-Policy': 'no-referrer',
      },
      body: path === '/' ? await demoHtml(true) : await readFile(new URL(file[0], root)),
    });
  });
  const page = await context.newPage();
  await page.goto(origin);
  return { page, goOffline: () => { offline = true; } };
}

async function waitFor(condition, description) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (condition()) return;
    await delay(25);
  }
  assert.fail(description);
}

async function newDomClient(t, { enabled = false, beforeRequest } = {}) {
  const { window } = new JSDOM(await demoHtml(enabled), { url: origin });
  t.after(() => window.close());
  const { document } = window;
  const requestPaths = [];
  let offline = false;
  window.fetch = async (path, options) => {
    requestPaths.push(path);
    if (offline) throw new Error('Offline');
    await beforeRequest?.(path, options);
    const { method, headers, body } = options;
    return mf.dispatchFetch(origin + path, { method, headers: { ...headers, Origin: origin }, body });
  };
  activateDemo(window);
  return {
    document,
    requestPaths,
    complete(id) { document.querySelector('input[value="' + id + '"]').click(); },
    action(name, code = '') {
      document.querySelector('#recover-code').value = code;
      document.querySelector('button[data-action="' + name + '"]').click();
    },
    waitForStatus(prefix) {
      const status = document.querySelector('#status');
      return waitFor(() => status.textContent.startsWith(prefix), 'Expected status ' + prefix);
    },
    waitForIdle() {
      return waitFor(() => !document.querySelector('[data-action="save"]').disabled, 'Expected request to finish');
    },
    issuedCode: () => document.querySelector('#new-code').textContent,
    completed: () => JSON.parse(window.localStorage.getItem(localKey)),
    storedKeys: () => Object.keys(window.localStorage),
    pageHide: () => window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true })),
    goOffline: () => { offline = true; },
  };
}

test('backup is off by default and local completion needs neither the network nor a binding', async t => {
  const device = await newDomClient(t);
  device.complete('sample-fox');
  assert.deepEqual(device.completed(), ['sample-fox']);
  assert.equal(device.document.querySelector('#backup-controls').hidden, true);
  for (const action of ['save', 'restore', 'revoke']) device.action(action);
  assert.deepEqual(device.requestPaths, []);

  for (const flag of [undefined, 'false', true]) {
    const env = {
      PROGRESS_BACKUP_ENABLED: flag,
      get PROGRESS_DB() { assert.fail('The disabled Worker must not access D1'); },
    };
    await assertUnavailable(await worker.fetch(new Request(origin + api + 'save'), env));
    await worker.scheduled(undefined, env);
  }
});

test('an enabled worker fails closed without the dedicated D1 binding and its session API', async () => {
  for (const bindings of [{ DB: db }, { PROGRESS_DB: { prepare: db.prepare } }]) {
    const env = { ...enabledBindings, ...bindings };
    const response = await worker.fetch(workerRequest('save', saveBody), env);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Backup service unavailable.' });
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    await assert.rejects(worker.scheduled(undefined, env), /Progress backup cleanup unavailable/);
  }
  assert.equal(await countBackups(), 0);
});

test('two independent synthetic clients save explicitly and merge current completion across Workerd D1', { timeout: 10000 }, async t => {
  const first = await newDomClient(t, { enabled: true });
  const restoreStarted = Promise.withResolvers();
  const continueRestore = Promise.withResolvers();
  t.after(() => continueRestore.resolve());
  const second = await newDomClient(t, {
    enabled: true,
    beforeRequest(path) {
      if (path !== api + 'restore') return;
      restoreStarted.resolve();
      return continueRestore.promise;
    },
  });
  first.complete('sample-fox');
  second.complete('sample-owl');
  assert.equal(await countBackups(), 0);
  assert.deepEqual(second.completed(), ['sample-owl']);

  first.action('save');
  await first.waitForStatus('Backup saved.');
  const code = first.issuedCode();
  assert.equal(code.length, 43);
  second.action('restore', code);
  await restoreStarted.promise;
  second.complete('sample-cupcake');
  const storage = second.document.defaultView.localStorage;
  const inFlightDrawing = JSON.stringify({ step: 2, drawingMode: 'trace', strokes: [{ tool: 'pencil' }] });
  storage.setItem(unrelatedDrawingKey, inFlightDrawing);
  continueRestore.resolve();
  await second.waitForStatus('Progress restored');
  assert.deepEqual(first.completed(), ['sample-fox']);
  assert.deepEqual(second.completed(), ['sample-cupcake', 'sample-fox', 'sample-owl']);
  assert.deepEqual(second.storedKeys(), [localKey, unrelatedDrawingKey]);
  assert.equal(storage.getItem(unrelatedDrawingKey), inFlightDrawing);
  assert.equal(second.document.querySelector('#recover-code').value, '');

  second.action('revoke', code);
  await second.waitForStatus('Backup deleted.');
  second.action('restore', code);
  await second.waitForStatus('Backup unavailable.');
  assert.deepEqual(second.completed(), ['sample-cupcake', 'sample-fox', 'sample-owl']);
  assert.equal(await countBackups(), 0);

  first.goOffline();
  first.complete('sample-cupcake');
  first.action('save');
  await first.waitForStatus('Could not complete');
  assert.deepEqual(first.completed(), ['sample-fox', 'sample-cupcake']);
  assert.equal(await countBackups(), 0);
});

test('separate saves issue separate codes and the demo clears them on dismiss and page exit', async t => {
  let lastRequest;
  const device = await newDomClient(t, {
    enabled: true,
    beforeRequest(path, options) { lastRequest = { path, options }; },
  });
  device.complete('sample-fox');
  device.action('save');
  await device.waitForStatus('Backup saved.');
  const firstCode = device.issuedCode();
  assert.equal(firstCode.length, 43);
  device.document.querySelector('#dismiss-code').click();
  assert.equal(device.issuedCode(), '');
  assert.equal(device.document.querySelector('#new-backup').hidden, true);

  device.action('save');
  await device.waitForStatus('Backup saved.');
  const secondCode = device.issuedCode();
  assert.equal(secondCode.length, 43);
  assert.ok(secondCode !== firstCode);
  assert.equal(await countBackups(), 2);
  assert.deepEqual(lastRequest && JSON.parse(lastRequest.options.body), saveBody);

  device.action('revoke', secondCode);
  await device.waitForStatus('Backup deleted.');
  assert.equal(device.issuedCode(), '');
  assert.ok(lastRequest.path === api + 'revoke');
  assert.ok(JSON.parse(lastRequest.options.body).code === secondCode);
  assert.equal(lastRequest.options.redirect, 'error');
  assert.equal(lastRequest.options.cache, 'no-store');
  assert.equal(lastRequest.options.credentials, 'omit');
  assert.equal(lastRequest.options.referrerPolicy, 'no-referrer');
  assert.ok(device.document.URL === origin + '/');
  await assertUnavailable(await request('restore', { code: secondCode }));
  assert.equal((await request('restore', { code: firstCode })).status, 200);

  device.action('save');
  await device.waitForStatus('Backup saved.');
  assert.equal(device.issuedCode().length, 43);
  const entered = device.document.querySelector('#recover-code');
  entered.value = firstCode;
  device.pageHide();
  assert.equal(device.issuedCode(), '');
  assert.equal(entered.value, '');
  assert.deepEqual(device.storedKeys(), [localKey]);
  assert.deepEqual(device.completed(), ['sample-fox']);
});

test('a save response received after navigation never redisplays the code', { timeout: 10000 }, async t => {
  const saveStarted = Promise.withResolvers();
  const continueSave = Promise.withResolvers();
  t.after(() => continueSave.resolve());
  const device = await newDomClient(t, {
    enabled: true,
    beforeRequest(_path, options) {
      saveStarted.resolve(options.signal);
      return continueSave.promise;
    },
  });
  device.complete('sample-fox');
  device.action('save');
  const signal = await saveStarted.promise;
  device.pageHide();
  assert.ok(signal.aborted);
  continueSave.resolve();
  await device.waitForIdle();
  assert.equal(await countBackups(), 1);
  assert.equal(device.issuedCode(), '');
  assert.equal(device.document.querySelector('#new-backup').hidden, true);
  assert.deepEqual(device.completed(), ['sample-fox']);
});

test('two isolated browsers save explicitly, merge completion and keep local progress after revocation', browserRequired, async t => {
  const { page: first } = await newDevice(t);
  const { page: second, goOffline } = await newDevice(t);

  await first.getByLabel('Sample fox').check();
  await second.getByLabel('Sample owl').check();
  assert.equal(await countBackups(), 0);
  assert.equal(await second.getByLabel('Sample fox').isChecked(), false);

  await first.getByRole('button', { name: 'Save a backup' }).click();
  await first.getByText('Backup saved.', { exact: false }).waitFor();
  const code = await first.locator('#new-code').textContent();
  assert.equal(code.length, 43);
  assert.equal(await countBackups(), 1);

  await second.getByLabel('Recovery code', { exact: true }).fill(code);
  await second.getByRole('button', { name: 'Bring back my progress' }).click();
  await second.getByText('Progress restored on this device.').waitFor();
  assert.equal(await second.getByLabel('Sample fox').isChecked(), true);
  assert.equal(await second.getByLabel('Sample owl').isChecked(), true);
  assert.equal(await first.getByLabel('Sample owl').isChecked(), false);
  assert.equal(await second.locator('#recover-code').inputValue(), '');

  await second.getByLabel('Recovery code', { exact: true }).fill(code);
  await second.getByRole('button', { name: 'Delete backup' }).click();
  await second.getByText('Backup deleted.').waitFor();
  assert.equal(await countBackups(), 0);
  await assertUnavailable(await request('restore', { code }));

  goOffline();
  await second.getByLabel('Sample cupcake').check();
  await second.getByLabel('Recovery code', { exact: true }).fill(code);
  await second.getByRole('button', { name: 'Bring back my progress' }).click();
  await second.getByText('Could not complete the backup request.').waitFor();
  await second.reload();
  await first.reload();
  assert.equal(await first.locator('#new-code').textContent(), '');
  assert.deepEqual(JSON.parse(await first.evaluate(key => localStorage.getItem(key), localKey)), ['sample-fox']);
  const secondStored = JSON.parse(await second.evaluate(key => localStorage.getItem(key), localKey));
  assert.deepEqual(new Set(secondStored), new Set(['sample-fox', 'sample-cupcake', 'sample-owl']));
  assert.deepEqual(await second.evaluate(() => Object.keys(localStorage)), [localKey]);
});

test('only versioned allowlisted IDs and an expiring capability digest are stored', async () => {
  const { code, expiresAt } = await saveCode({ version: 1, completed: ['sample-owl', 'sample-fox', 'sample-fox'] });
  assert.ok(/^[A-Za-z0-9_-]{43}$/.test(code));
  const { results: [row] } = await db.prepare('SELECT * FROM progress_backups').all();
  assert.deepEqual(Object.keys(row).sort(), ['code_digest', 'completed_lessons', 'expires_at', 'schema_version']);
  const expectedDigest = createHash('sha256').update(code).digest('hex');
  assert.ok(row.code_digest === expectedDigest);
  assert.equal(row.schema_version, 1);
  assert.equal(row.completed_lessons, '["sample-fox","sample-owl"]');
  assert.equal(Date.parse(expiresAt) / 1000, row.expires_at);
  assert.ok(Math.abs(row.expires_at - (Date.now() / 1000 + 30 * 86400)) < 15);

  const restored = await request('restore', { code });
  assert.equal(restored.status, 200);
  assert.deepEqual(await restored.json(), { version: 1, completed: ['sample-fox', 'sample-owl'] });
  assert.match(restored.headers.get('Cache-Control'), /no-store/);
  assert.equal(restored.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(restored.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');

  for (const invalid of [
    { ...saveBody, name: 'synthetic extra field' },
    { ...saveBody, version: 2 },
    { version: 1, completed: ['sample-unlisted'] },
    { version: 1, completed: [] },
    { version: 1, completed: Array(4).fill('sample-fox') },
  ]) {
    assert.equal((await request('save', invalid)).status, 400);
  }
  const oversized = { ...saveBody, extra: 'x'.repeat(1024) };
  assert.equal((await request('save', oversized)).status, 400);
  assert.equal(await countBackups(), 1);
});

test('malformed, unknown, expired and revoked capabilities fail closed', async () => {
  const { code: expired } = await saveCode();
  const { code: revoked } = await saveCode();
  const expiredDigest = createHash('sha256').update(expired).digest('hex');
  await db.prepare('UPDATE progress_backups SET expires_at = unixepoch() WHERE code_digest = ?')
    .bind(expiredDigest).run();
  assert.equal((await request('revoke', { code: revoked })).status, 204);

  for (const code of ['short', 'A'.repeat(43), expired, revoked]) {
    await assertUnavailable(await request('restore', { code }));
    await assertUnavailable(await request('revoke', { code }));
  }
  assert.equal(await countBackups(), 1);
  await saveCode();
  assert.equal(await countBackups(), 1);
});

test('revocation confirms row deletion before a fresh restore on a separate request', async () => {
  const { code } = await saveCode();
  const digest = createHash('sha256').update(code).digest('hex');
  const deleted = await request('revoke', { code });
  assert.equal(deleted.status, 204);
  assert.match(deleted.headers.get('Cache-Control'), /no-store/);
  const [restore, row] = await Promise.all([
    request('restore', { code }),
    db.withSession('first-primary').prepare('SELECT 1 FROM progress_backups WHERE code_digest = ?')
      .bind(digest).first(),
  ]);
  await assertUnavailable(restore);
  assert.equal(row, null);
});

test('a failed deletion confirmation returns a generic failure after using the same primary session', async () => {
  const { code } = await saveCode();
  const sessionTrace = [];
  const response = await worker.fetch(workerRequest('revoke', { code }), {
    ...enabledBindings,
    PROGRESS_DB: {
      prepare(sql) { return db.prepare(sql); },
      withSession(constraint) {
        const session = db.withSession(constraint);
        sessionTrace.push(constraint);
        return {
          prepare(sql) {
            const operation = sql.trimStart().split(' ', 1)[0];
            sessionTrace.push(operation);
            if (operation === 'SELECT') throw new Error('Synthetic D1 verification failure.');
            return session.prepare(sql);
          },
        };
      },
    },
  });
  assert.deepEqual(sessionTrace, ['first-primary', 'DELETE', 'SELECT']);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Backup service unavailable.' });
  assert.equal(await countBackups(), 0);
  await assertUnavailable(await request('restore', { code }));
});

test('the local scheduled handler sweeps only expired rows, at most 100 per invocation', async () => {
  const { code: active } = await saveCode();
  const { code: expired } = await saveCode();
  const expiredDigest = createHash('sha256').update(expired).digest('hex');
  await db.prepare('UPDATE progress_backups SET expires_at = unixepoch() - 3600 WHERE code_digest = ?')
    .bind(expiredDigest).run();
  await db.prepare(`
    WITH RECURSIVE number(n) AS (VALUES (1) UNION ALL SELECT n + 1 FROM number WHERE n < 104)
    INSERT INTO progress_backups
    SELECT printf('%064x', n), 1, '["sample-owl"]', unixepoch() - 120 FROM number
  `).run();
  await assertUnavailable(await request('restore', { code: expired }));
  assert.equal(await countBackups(), 106);

  const sweep = () => mf.dispatchFetch(origin + '/cdn-cgi/handler/scheduled');
  assert.equal((await sweep()).status, 200);
  assert.equal(await countBackups(), 6);
  assert.equal((await sweep()).status, 200);
  assert.equal(await countBackups(), 1);
  assert.equal((await request('restore', { code: active })).status, 200);
});

test('only same-origin JSON posts to exact paths can reach backup operations', async () => {
  await assertUnavailable(await request('save', saveBody, { headers: { Origin: 'https://other.test' } }));
  await assertUnavailable(await request('save', saveBody, { headers: { Origin: '' } }));
  await assertUnavailable(await request('save', saveBody, { headers: { 'Sec-Fetch-Site': 'cross-site' } }));
  await assertUnavailable(await request('save', saveBody, { path: api + 'save?unexpected=1' }));
  await assertUnavailable(await request('list', {}));
  await assertUnavailable(await request('restore/', {}));
  assert.equal((await request('save', undefined, { method: 'GET' })).status, 405);
  assert.equal((await request('save', saveBody, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal(await countBackups(), 0);
});

test('concurrent attempts share a bounded rate limit without requester identifiers', async () => {
  await db.prepare(`
    INSERT INTO progress_request_limits VALUES ('restore', (unixepoch() / 60 + 1) * 60, 58)
  `).run();
  const attempts = await Promise.all(Array.from({ length: 4 }, () => request('restore', { code: 'short' })));
  assert.deepEqual(attempts.map(response => response.status).sort(), [404, 404, 429, 429]);
  assert.ok(attempts.filter(response => response.status === 429)
    .every(response => response.headers.get('Retry-After') === '60'));
  const { results: [bucket] } = await db.prepare('SELECT * FROM progress_request_limits').all();
  assert.deepEqual(Object.keys(bucket).sort(), ['action', 'attempts', 'window_start']);
  assert.equal(bucket.attempts, 60);
  await db.prepare("UPDATE progress_request_limits SET window_start = 0 WHERE action = 'restore'").run();
  await assertUnavailable(await request('restore', { code: 'short' }));
  assert.equal(await db.prepare("SELECT attempts FROM progress_request_limits WHERE action = 'restore'").first('attempts'), 1);
  await saveCode();
});

test('capacity is bounded even when two valid saves race for the last slot', async () => {
  await db.prepare(`
    WITH RECURSIVE number(n) AS (VALUES (1) UNION ALL SELECT n + 1 FROM number WHERE n < 999)
    INSERT INTO progress_backups
    SELECT printf('%064x', n), 1, '["sample-fox"]', unixepoch() + 3600 FROM number
  `).run();
  const responses = await Promise.all([request('save', saveBody), request('save', saveBody)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 503]);
  assert.equal(await countBackups(), 1000);
});

test('the existing game finishes a paper lesson and retains its checkmark on reload', browserRequired, async t => {
  const context = await (await getBrowser()).newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
  t.after(() => context.close());
  const gameFiles = new Map([
    ['/', ['index.html', 'text/html']],
    ['/style.css', ['style.css', 'text/css']],
    ['/logo.svg', ['logo.svg', 'image/svg+xml']],
    ...['lessons.js', 'art.js', 'coach.js', 'app.js'].map(file => ['/' + file, [file, 'text/javascript']]),
  ]);
  const unexpected = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const file = gameFiles.get(url.pathname);
    if (url.origin !== gameOrigin || !file) {
      unexpected.push(url.pathname);
      return route.abort();
    }
    return route.fulfill({ contentType: file[1], body: await readFile(new URL('../dist/' + file[0], root)) });
  });
  const page = await context.newPage();
  await page.goto(gameOrigin + '/#draw/little-fox');
  const next = page.locator('.paper-actions [data-action="next"]');
  for (let i = 0; i < 20 && await next.isVisible(); i++) await next.click();
  await page.getByText('You drew it!', { exact: true }).waitFor();
  await page.locator('#nav-sketchbook').click();
  await page.locator('.completion-mark').waitFor();
  await page.reload();
  await page.locator('.completion-mark').waitFor();
  assert.deepEqual(unexpected, []);
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['little-pencil-club/little-fox']);
});
