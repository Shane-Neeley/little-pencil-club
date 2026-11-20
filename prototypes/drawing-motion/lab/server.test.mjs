import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createMotionLab, preview } from './server.mjs';

const original = await readFile(new URL('../jellyfish.png', import.meta.url));
const mockGif = await readFile(new URL('./fixture-motion.gif', import.meta.url));
const bounce = { answers: [{ type: 'choice', name: 'motion', choice: 'bounce' }] };

test('the Decisions request carries only the fixture, and only the fixed presets are accepted', async () => {
  let sent;
  const result = await preview('preset', async request => {
    sent = request;
    return bounce;
  });
  assert.equal(sent.path, '/v1/decisions');
  assert.equal(sent.body.model, 'gpt-6-luna');
  const image = sent.body.input[0].content[1];
  assert.equal(image.type, 'input_image');
  assert.equal(image.image_url, `data:image/png;base64,${original.toString('base64')}`);
  assert.deepEqual(sent.body.questions[0].choices.map(({ value }) => value), ['wiggle', 'bounce']);
  assert.deepEqual(result, { kind: 'preset', preset: 'bounce' });
  for (const response of [
    { answers: [{ ...bounce.answers[0], choice: 'spin' }] },
    { answers: [{ type: 'refusal', name: 'motion' }] },
    { answers: { 0: bounce.answers[0], length: 1 } },
    {},
  ]) {
    assert.deepEqual(await preview('preset', async () => response), { kind: 'local' });
  }
});

test('the GIF edit describes a bounded fixture animation and validates the returned bytes', async () => {
  let sent;
  const result = await preview('gif', async request => {
    sent = request;
    return { data: [{ b64_json: mockGif.toString('base64') }] };
  });
  assert.equal(sent.path, '/v1/images/edits');
  assert.equal(sent.body.get('model'), 'gpt-image-2.6-flare');
  assert.equal(sent.body.get('output_format'), 'gif');
  assert.equal(Number(sent.body.get('frame_count')) * Number(sent.body.get('frame_duration_ms')), 1440);
  assert.deepEqual(Buffer.from(await sent.body.get('image').arrayBuffer()), original);
  assert.equal(result.kind, 'gif');
  assert.deepEqual(Buffer.from(result.gif, 'base64'), mockGif);
  const oversizedGif = Buffer.from(mockGif);
  oversizedGif.writeUInt16LE(2049, 6);
  for (const gif of ['broken!', original.toString('base64'), oversizedGif.toString('base64')]) {
    assert.deepEqual(await preview('gif', async () => ({ data: [{ b64_json: gif }] })), { kind: 'local' });
  }
});

test('timeouts and rejected requests fall back without retrying', async () => {
  let calls = 0;
  let signaled = false;
  const neverFinishes = (_, { signal }) => {
    calls += 1;
    signal.addEventListener('abort', () => { signaled = true; });
    return new Promise(() => {});
  };
  assert.deepEqual(await preview('preset', neverFinishes, 20), { kind: 'local' });
  assert.equal(calls, 1);
  assert.equal(signaled, true);
  assert.deepEqual(await preview('gif', async () => { throw new Error('Moderation rejected the request'); }), { kind: 'local' });
});

test('the loopback lab rejects submitted images and unknown routes', async t => {
  const server = createMotionLab();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Synthetic motion lab/);
  const originalResponse = await fetch(`${url}/jellyfish.png`);
  assert.deepEqual(Buffer.from(await originalResponse.arrayBuffer()), original);
  assert.equal((await fetch(`${url}/lab/server.mjs`)).status, 404);
  assert.equal((await fetch(`${url}/preview/gif`, { method: 'POST', body: original })).status, 400);
  assert.equal((await fetch(`${url}/preview/preset`, {
    method: 'POST', headers: { Origin: 'https://example.com' },
  })).status, 403);
  const response = await fetch(`${url}/preview/preset`, { method: 'POST' });
  assert.deepEqual(await response.json(), { kind: 'preset', preset: 'wiggle' });
});
