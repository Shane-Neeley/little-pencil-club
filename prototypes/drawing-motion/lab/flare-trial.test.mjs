import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createFlareGifTrial } from './flare-trial.mjs';

const still = await readFile(new URL('../jellyfish.png', import.meta.url));
const fixtureGif = await readFile(new URL('./fixture-motion.gif', import.meta.url));
const singleFrame = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const b64 = fixtureGif.toString('base64');
const reply = (body = { data: [{ b64_json: b64 }] }) => Response.json(body);
const mockOptions = fetchImpl => ({
  enabled: true, reservedRequests: 1, apiKey: 'fixture-no-network', fetchImpl,
});
const fallback = reason => ({ kind: 'local', reason });

test('disabled and missing one-request reservation or transport never dispatch', async () => {
  let calls = 0;
  const canary = async () => { calls++; return reply(); };
  for (const [settings, reason] of [
    [{ ...mockOptions(canary), enabled: undefined }, 'disabled'],
    [{ ...mockOptions(canary), reservedRequests: undefined }, 'reservation_required'],
    [{ ...mockOptions(canary), reservedRequests: 2 }, 'reservation_required'],
    [{ ...mockOptions(canary), apiKey: undefined }, 'invalid_configuration'],
    [{ ...mockOptions(canary), apiKey: 'value\nOther-Header: no' }, 'invalid_configuration'],
    [{ ...mockOptions(undefined) }, 'invalid_configuration'],
    [{ ...mockOptions(canary), timeoutMs: 120001 }, 'invalid_configuration'],
  ]) {
    assert.deepEqual(await createFlareGifTrial(settings)(), fallback(reason));
  }
  assert.equal(calls, 0);
});

test('only the checked-in PNG is sent once to the exact Flare edit endpoint', async () => {
  let requests = 0;
  const trial = createFlareGifTrial(mockOptions(async (url, options) => {
    requests++;
    assert.equal(url, 'https://api.openai.com/v1/images/edits');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, 'Bearer fixture-no-network');
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual([...options.body.keys()], ['model', 'image[]', 'prompt', 'quality', 'moderation',
      'size', 'n', 'output_format', 'frame_count', 'frame_duration_ms']);
    assert.equal(options.body.get('model'), 'gpt-image-2.6-flare');
    assert.equal(options.body.get('n'), '1');
    assert.equal(options.body.get('output_format'), 'gif');
    assert.equal(options.body.get('moderation'), 'auto');
    assert.equal(options.body.get('frame_count'), '6');
    assert.equal(options.body.get('frame_duration_ms'), '240');
    const image = options.body.get('image[]');
    assert.equal(image.type, 'image/png');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), still);
    return reply();
  }));
  assert.deepEqual(await trial(Buffer.from('an arbitrary input is out of scope')), { kind: 'gif', gif: b64 });
  assert.deepEqual(await trial(), fallback('already_attempted'));
  assert.equal(requests, 1);
});

test('bad HTTP, redirects, bad media types, refusals and malformed JSON close without retry', async () => {
  for (const responder of [
    () => Response.json({ error: 'fixture failure' }, { status: 429 }),
    () => new Response(null, { status: 307, headers: { Location: 'https://example.invalid/' } }),
    () => new Response(JSON.stringify({ data: [{ b64_json: b64 }] })),
    () => new Response('<not JSON>', { headers: { 'Content-Type': 'application/json' } }),
    () => reply({ error: 'fixture refusal', data: [{ b64_json: b64 }] }),
    () => { throw new Error('provider details must not escape'); },
  ]) {
    let requests = 0;
    const trial = createFlareGifTrial(mockOptions(async () => { requests++; return responder(); }));
    assert.deepEqual(await trial(), fallback('provider_failure'));
    assert.deepEqual(await trial(), fallback('already_attempted'));
    assert.equal(requests, 1);
  }
});

test('bounds streaming response bytes without a content-length header', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2_750_000)); },
    cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'application/json' } });
  const trial = createFlareGifTrial(mockOptions(async () => response));
  assert.deepEqual(await trial(), fallback('provider_failure'));
  assert.equal(cancelled, true);
});

test('wrong result count, still GIF and truncated animation cannot pass', async () => {
  const truncated = Buffer.concat([fixtureGif.subarray(0, fixtureGif.length - 24), Buffer.from([0x3b])]);
  for (const payload of [
    { data: [] },
    { data: [{ b64_json: b64 }, { b64_json: b64 }] },
    { data: [{ b64_json: still.toString('base64') }] },
    { data: [{ b64_json: singleFrame }] },
    { data: [{ b64_json: truncated.toString('base64') }] },
  ]) {
    const trial = createFlareGifTrial(mockOptions(async () => reply(payload)));
    assert.deepEqual(await trial(), fallback('invalid_gif'));
  }
});

test('the sole attempt is consumed before a timeout or concurrent call, and late success is ignored', async () => {
  let resolveProvider;
  let fetchSignal;
  let requests = 0;
  const trial = createFlareGifTrial({
    ...mockOptions((_, { signal }) => {
      requests++;
      fetchSignal = signal;
      return new Promise(resolve => { resolveProvider = resolve; });
    }),
    timeoutMs: 20,
  });
  const first = trial();
  assert.deepEqual(await trial(), fallback('already_attempted'));
  assert.deepEqual(await first, fallback('timeout'));
  assert.equal(fetchSignal.aborted, true);
  resolveProvider(reply());
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(await trial(), fallback('already_attempted'));
  assert.equal(requests, 1);
});
