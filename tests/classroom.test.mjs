import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';
import { initLocalDatabase, localOwnerId, localWorker } from '../scripts/local-classroom.mjs';

const origin = 'https://classroom.example.test';
const api = '/classroom/api';
const write = { origin };
const adult = { 'oai-authenticated-user-id': localOwnerId };

async function fetchRoute(worker, path, { method = 'GET', headers = {}, body } = {}) {
  const request = { method, redirect: 'manual', headers: { ...(method === 'GET' ? {} : write), ...headers } };
  if (body !== undefined) {
    request.headers['content-type'] ??= 'application/json';
    request.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return worker.dispatchFetch(origin + path, request);
}

function expectPrivate(response) {
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  assert.match(response.headers.get('x-robots-tag'), /noindex.*noimageindex/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
}

async function makeClass(worker) {
  const result = await fetchRoute(worker, api + '/classes', { method: 'POST', headers: adult });
  assert.equal(result.status, 201);
  return (await result.json()).id;
}

async function makeInvite(worker, id) {
  const result = await fetchRoute(worker, api + '/classes/' + id + '/invite', { method: 'POST', headers: adult });
  assert.equal(result.status, 201);
  expectPrivate(result);
  const { url, modules } = await result.json();
  assert.match(modules[0], /^[01]+$/);
  const resolved = new URL(url);
  assert.equal(resolved.pathname, '/classroom');
  assert.equal(resolved.search, '');
  assert.match(resolved.hash, /^#[a-f0-9]{64}$/);
  return resolved.hash.slice(1);
}

async function joinClass(worker, invite) {
  const response = await fetchRoute(worker, api + '/join', { method: 'POST', body: { invite } });
  assert.equal(response.status, 204);
  expectPrivate(response);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /^__Host-lpc-class=[a-f0-9]{64}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=\d+$/);
  return { cookie: cookie.split(';')[0] };
}

function checkCleanPng(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const chunks = [];
  let next = 8;
  while (next < bytes.length) {
    const length = bytes.readUInt32BE(next);
    const name = bytes.subarray(next + 4, next + 8).toString();
    const chunk = bytes.subarray(next + 8, next + 8 + length);
    chunks.push(name);
    if (name === 'IHDR') {
      assert.equal(chunk.readUInt32BE(0), 192);
      assert.equal(chunk.readUInt32BE(4), 132);
      assert.equal(chunk[8], 8);
      assert.equal(chunk[9], 2);
    }
    if (name === 'IDAT') assert.equal(inflateSync(chunk).length, 132 * (192 * 3 + 1));
    next += length + 12;
  }
  assert.deepEqual(chunks, ['IHDR', 'IDAT', 'IEND']);
  assert.equal(next, bytes.length);
  assert.ok(bytes.length < 16384);
}

test('classroom in workerd with isolated local D1 and R2', async t => {
  const storage = await mkdtemp(join(tmpdir(), 'lpc-local-'));
  let worker = localWorker(storage);
  t.after(async () => {
    await worker.dispose();
    await rm(storage, { recursive: true, force: true });
  });
  let db = await worker.getD1Database('DB');
  let bucket = await worker.getR2Bucket('BUCKET');
  await initLocalDatabase(db);
  const recordCount = async table => (await db.prepare('SELECT COUNT(*) AS count FROM ' + table).first()).count;

  await t.test('public paper-first routes retain the exact game assets', async () => {
    for (const [route, filename] of [['/', 'index.html'], ['/app.js', 'app.js'], ['/lessons.js', 'lessons.js'],
      ['/style.css', 'style.css'], ['/art.js', 'art.js'], ['/coach.js', 'coach.js'], ['/logo.svg', 'logo.svg']]) {
      const response = await fetchRoute(worker, route);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.equal(await response.text(), await readFile('dist/' + filename, 'utf8'));
    }
    const script = await readFile('dist/app.js', 'utf8');
    assert.match(script, /page === 'draw'/);
    assert.match(script, /saved\?\.mode : 'paper'/);
    assert.match(script, /function savePng/);
    const hosting = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
    assert.equal(hosting.static.directory, 'dist');
    assert.equal(hosting.d1 ?? null, null);
    assert.equal(hosting.r2 ?? null, null);
  });

  await t.test('disabled environment or either missing storage binding fails closed', async () => {
    for (const overrides of [{ bindings: {} }, { d1Databases: {} }, { r2Buckets: {} }]) {
      const disabled = localWorker(false, overrides);
      try {
        assert.equal((await fetchRoute(disabled, '/')).status, 200);
        const response = await fetchRoute(disabled, api + '/classes', { method: 'POST', headers: adult });
        assert.equal(response.status, 503);
        expectPrivate(response);
      } finally {
        await disabled.dispose();
      }
    }
  });

  const classA = await makeClass(worker);
  const classB = await makeClass(worker);
  const inviteA = await makeInvite(worker, classA);
  const inviteB = await makeInvite(worker, classB);
  const adminA = api + '/classes/' + classA + '/drawings';
  const adminB = api + '/classes/' + classB + '/drawings';
  const gallery = api + '/gallery';

  await t.test('QR navigation is inert, strips the fragment before scripts, and exchanges only on same-origin POST', async () => {
    const response = await fetchRoute(worker, '/classroom#' + inviteA, { headers: { 'sec-purpose': 'prefetch' } });
    assert.equal(response.status, 200);
    expectPrivate(response);
    assert.equal(response.headers.get('set-cookie'), null);
    const html = await response.text();
    const bootstrap = html.match(/<script data-invite-boot>([^<]+)<\/script>/)[1];
    assert.match(bootstrap, /history\.replaceState/);
    const hash = createHash('sha256').update(bootstrap).digest('base64');
    assert.ok(response.headers.get('content-security-policy').includes(hash));
    assert.ok(!html.includes(inviteA));
    assert.equal((await fetchRoute(worker, '/classroom?invite=' + inviteA)).headers.get('location'), '/classroom');
    assert.equal((await fetchRoute(worker, api + '/join?invite=' + inviteA)).status, 404);
    assert.equal((await fetchRoute(worker, api + '/join', { method: 'POST', headers: { origin: 'https://different.example' },
      body: { invite: inviteA } })).status, 403);
    assert.equal(await recordCount('memberships'), 0);
    assert.equal((await db.prepare('SELECT token_hash FROM invites WHERE token_hash = ?').bind(inviteA).first()), null);
  });

  const pupilA = await joinClass(worker, inviteA);
  const repeatJoin = await fetchRoute(worker, api + '/join', { method: 'POST', headers: pupilA, body: { invite: inviteA } });
  assert.equal(repeatJoin.status, 204);
  assert.equal(repeatJoin.headers.get('set-cookie'), null);
  assert.equal(await recordCount('memberships'), 1);
  const peerA = await joinClass(worker, inviteA);
  const pupilB = await joinClass(worker, inviteB);
  assert.notEqual(pupilA.cookie, peerA.cookie);
  let drawing;
  let image;
  let objectKey;

  await t.test('real files, personal metadata and uncertain samples never persist', async () => {
    assert.equal((await fetchRoute(worker, api + '/submit', { method: 'POST', headers: pupilA,
      body: { preset: 'uncertain' } })).status, 422);
    assert.equal((await fetchRoute(worker, api + '/submit', { method: 'POST', headers: pupilA,
      body: { preset: 'sun', label: 'arbitrary' } })).status, 400);
    assert.equal((await fetchRoute(worker, api + '/submit', { method: 'POST',
      headers: { ...pupilA, 'content-type': 'image/png' }, body: 'not accepted' })).status, 400);
    assert.equal((await fetchRoute(worker, api + '/submit', { method: 'POST',
      headers: pupilA, body: ' '.repeat(129) })).status, 400);
    assert.equal(await recordCount('drawings'), 0);
    assert.equal((await bucket.list()).objects.length, 0);
  });

  await t.test('screened samples publish automatically and stay private to separate clients of the same class', async () => {
    const response = await fetchRoute(worker, api + '/submit', { method: 'POST', headers: pupilA, body: { preset: 'sun' } });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { state: 'approved' });
    const peerGallery = await fetchRoute(worker, gallery, { headers: peerA });
    assert.equal(peerGallery.status, 200);
    expectPrivate(peerGallery);
    [drawing] = await peerGallery.json();
    assert.equal(drawing.label, 'Sun and hills');
    image = api + '/images/' + drawing.id;
    objectKey = 'classroom/v1/' + drawing.id + '.png';
    const png = await fetchRoute(worker, image, { headers: peerA });
    assert.equal(png.status, 200);
    assert.equal(png.headers.get('content-type'), 'image/png');
    expectPrivate(png);
    checkCleanPng(Buffer.from(await png.arrayBuffer()));

    assert.deepEqual(await (await fetchRoute(worker, gallery, { headers: pupilB })).json(), []);
    assert.equal((await fetchRoute(worker, image)).status, 404);
    assert.equal((await fetchRoute(worker, image, { headers: pupilB })).status, 404);
    assert.equal((await fetchRoute(worker, '/' + objectKey, { headers: pupilA })).status, 404);
    assert.equal((await fetchRoute(worker, image, { headers: { ...peerA, 'sec-fetch-site': 'cross-site' } })).status, 403);
    assert.equal((await fetchRoute(worker, image + '/report', { method: 'POST', headers: pupilB })).status, 404);
    assert.equal((await fetchRoute(worker, image + '/report', { method: 'POST', headers: { ...pupilA, origin: '' } })).status, 403);
  });

  await t.test('access to controls and adult image reads require the allowlisted identity and correct class', async () => {
    assert.equal((await fetchRoute(worker, adminA, { headers: pupilA })).status, 404);
    assert.equal((await fetchRoute(worker, adminA + '/' + drawing.id)).status, 404);
    assert.equal((await fetchRoute(worker, adminA, {
      headers: { 'oai-authenticated-user-id': 'fixture-other-adult' },
    })).status, 404);
    assert.equal((await fetchRoute(worker, adminA + '/' + drawing.id, { headers: adult })).status, 200);
    assert.equal((await fetchRoute(worker, adminB + '/' + drawing.id, { headers: adult })).status, 404);
    assert.equal((await fetchRoute(worker, adminB + '/' + drawing.id, { headers: adult, method: 'DELETE' })).status, 404);
    assert.equal((await fetchRoute(worker, adminA + '/' + drawing.id, { headers: adult, method: 'POST' })).status, 404);
  });

  await t.test('D1 data and R2 bytes persist independently through a Worker restart', async () => {
    await worker.dispose();
    worker = localWorker(storage);
    db = await worker.getD1Database('DB');
    bucket = await worker.getR2Bucket('BUCKET');
    const row = await db.prepare('SELECT class_id, state FROM drawings WHERE id = ?').bind(drawing.id).first();
    assert.deepEqual(row, { class_id: classA, state: 'approved' });
    const object = await bucket.get(objectKey);
    assert.ok(object);
    checkCleanPng(Buffer.from(await object.arrayBuffer()));
    assert.equal((await fetchRoute(worker, image, { headers: peerA })).status, 200);
  });

  await t.test('report hides a sample immediately; adult removal deletes both records and bytes', async () => {
    assert.equal((await fetchRoute(worker, image + '/report', { method: 'POST', headers: peerA })).status, 204);
    assert.equal((await fetchRoute(worker, image, { headers: pupilA })).status, 404);
    assert.deepEqual(await (await fetchRoute(worker, gallery, { headers: peerA })).json(), []);
    assert.equal((await fetchRoute(worker, image + '/report', { method: 'POST', headers: peerA })).status, 404);
    const entries = await (await fetchRoute(worker, adminA, { headers: adult })).json();
    assert.equal(entries[0].state, 'reported');
    assert.equal((await fetchRoute(worker, adminA + '/' + drawing.id, { headers: adult })).status, 200);
    assert.equal((await fetchRoute(worker, adminA + '/' + drawing.id, { method: 'DELETE', headers: adult })).status, 204);
    assert.equal(await bucket.get(objectKey), null);
    assert.equal(await recordCount('drawings'), 0);
    assert.equal((await fetchRoute(worker, adminA + '/' + drawing.id, { headers: adult })).status, 404);
  });

  await t.test('rotation, explicit revocation and invite expiry invalidate established sessions', async () => {
    const rotated = await makeInvite(worker, classA);
    assert.equal((await fetchRoute(worker, gallery, { headers: pupilA })).status, 404);
    assert.equal((await fetchRoute(worker, gallery, { headers: peerA })).status, 404);
    assert.equal((await fetchRoute(worker, api + '/join', { method: 'POST', body: { invite: inviteA } })).status, 404);
    const rotatedClient = await joinClass(worker, rotated);
    assert.equal((await fetchRoute(worker, gallery, { headers: pupilB })).status, 200);
    assert.equal((await fetchRoute(worker, api + '/classes/' + classA + '/invite', { headers: adult, method: 'DELETE' })).status, 204);
    assert.equal((await fetchRoute(worker, api + '/submit', { method: 'POST', headers: rotatedClient, body: { preset: 'moon' } })).status, 404);
    const expiryInvite = await makeInvite(worker, classA);
    const expiryClient = await joinClass(worker, expiryInvite);
    assert.equal((await fetchRoute(worker, api + '/submit', { method: 'POST', headers: expiryClient, body: { preset: 'kite' } })).status, 201);
    const [sample] = await (await fetchRoute(worker, gallery, { headers: expiryClient })).json();
    const now = Math.floor(Date.now() / 1000);
    await db.prepare('UPDATE invites SET created_at = ?, expires_at = ? WHERE class_id = ? AND revoked_at IS NULL')
      .bind(now - 100, now - 1, classA).run();
    assert.equal((await fetchRoute(worker, gallery, { headers: expiryClient })).status, 404);
    assert.equal((await fetchRoute(worker, api + '/images/' + sample.id, { headers: expiryClient })).status, 404);
    assert.equal((await fetchRoute(worker, api + '/join', { method: 'POST', body: { invite: expiryInvite } })).status, 404);
    await db.prepare('UPDATE classes SET created_at = ?, expires_at = ? WHERE id = ?').bind(now - 100, now - 1, classA).run();
    await db.prepare('UPDATE drawings SET created_at = ?, expires_at = ? WHERE id = ?').bind(now - 100, now - 1, sample.id).run();
    assert.equal((await fetchRoute(worker, adminA + '/' + sample.id, { headers: adult })).status, 404);
    assert.equal((await fetchRoute(worker, api + '/cleanup', { method: 'POST', headers: adult })).status, 204);
    assert.equal(await recordCount('drawings'), 0);
    assert.equal((await bucket.list()).objects.length, 0);
  });

  await t.test('an unfinalized write stays invisible and cleanup removes its abandoned reservation and image', async () => {
    const time = Math.floor(Date.now() / 1000);
    const id = 'f'.repeat(32);
    const object = 'classroom/v1/' + id + '.png';
    await db.prepare("INSERT INTO drawings VALUES (?, ?, ?, 'Sun and hills', 'writing', ?, ?)")
      .bind(id, classB, 'fixture-no-credentials', time - 150, time + 10).run();
    await bucket.put(object, 'temporary fixture');
    assert.deepEqual(await (await fetchRoute(worker, gallery, { headers: pupilB })).json(), []);
    assert.equal((await fetchRoute(worker, api + '/images/' + id, { headers: pupilB })).status, 404);
    assert.equal((await fetchRoute(worker, adminB + '/' + id, { headers: adult })).status, 404);
    assert.equal((await fetchRoute(worker, api + '/cleanup', { method: 'POST', headers: adult })).status, 204);
    assert.equal(await bucket.get(object), null);
    assert.equal(await recordCount('drawings'), 0);
  });

  await t.test('capacity is bounded, and leaving revokes only that session', async () => {
    const otherPupilB = await joinClass(worker, inviteB);
    const sessions = [pupilB, otherPupilB];
    const source = Array.from({ length: 25 }, (_, index) => sessions[index % 2]);
    const submissions = await Promise.all(source.map(headers => fetchRoute(worker, api + '/submit', {
      method: 'POST', headers, body: { preset: 'moon' },
    })));
    assert.ok(submissions.every(({ status }) => status === 201 || status === 409));
    const accepted = submissions.filter(({ status }) => status === 201).length;
    assert.ok(accepted > 0 && accepted <= 24);
    assert.equal(await recordCount('drawings'), accepted);
    for (let count = accepted; count < 24; count++) {
      assert.equal((await fetchRoute(worker, api + '/submit', {
        method: 'POST', headers: pupilB, body: { preset: 'moon' },
      })).status, 201);
    }
    assert.equal((await fetchRoute(worker, api + '/submit', {
      method: 'POST', headers: pupilB, body: { preset: 'moon' },
    })).status, 409);
    const leave = await fetchRoute(worker, api + '/leave', { method: 'POST', headers: pupilB });
    assert.equal(leave.status, 204);
    assert.match(leave.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await fetchRoute(worker, gallery, { headers: pupilB })).status, 404);
    assert.equal((await fetchRoute(worker, gallery, { headers: otherPupilB })).status, 200);
  });

  await t.test('class expiry cuts off a still-current invite, membership and direct image', async () => {
    const fresh = await joinClass(worker, inviteB);
    const [sample] = await (await fetchRoute(worker, gallery, { headers: fresh })).json();
    const time = Math.floor(Date.now() / 1000);
    await db.prepare('UPDATE classes SET created_at = ?, expires_at = ? WHERE id = ?').bind(time - 100, time - 1, classB).run();
    assert.equal((await fetchRoute(worker, api + '/join', { method: 'POST', body: { invite: inviteB } })).status, 404);
    assert.equal((await fetchRoute(worker, gallery, { headers: fresh })).status, 404);
    assert.equal((await fetchRoute(worker, api + '/images/' + sample.id, { headers: fresh })).status, 404);
    assert.equal((await fetchRoute(worker, adminB + '/' + sample.id, { headers: adult })).status, 404);
  });
});
