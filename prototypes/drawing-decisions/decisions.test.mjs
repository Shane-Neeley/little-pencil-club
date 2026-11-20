import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createDrawingClassifier, createScreenedSubmission, ENDPOINT, MODEL } from './decisions.mjs';
import { mockAnswer, runSyntheticBenchmark } from './benchmark.mjs';
import { fixtures } from './synthetic-fixtures.mjs';

function system(transport, options = {}) {
  const calls = { prepare: 0, transport: 0, disk: [], shared: [], animation: [] };
  let acknowledgedSignal;
  const classify = createDrawingClassifier({
    enabled: options.providerEnabled ?? true,
    timeoutMs: options.timeoutMs,
    transport(request) {
      calls.transport++;
      acknowledgedSignal = request.signal;
      return transport(request);
    },
  });
  const submit = createScreenedSubmission({
    enabled: options.submissionEnabled ?? true,
    classify,
    prepare(input) {
      calls.prepare++;
      if (options.localOutcome) return { outcome: options.localOutcome };
      return { outcome: 'clear', bytes: input };
    },
    onApproved(bytes) {
      calls.disk.push(bytes);
      calls.shared.push(bytes);
      calls.animation.push(bytes);
    },
  });
  return { calls, submit, signal: () => acknowledgedSignal };
}

function noEffects(calls) {
  assert.deepEqual(calls.disk, []);
  assert.deepEqual(calls.shared, []);
  assert.deepEqual(calls.animation, []);
}

const sample = () => fixtures[0].image();

test('request follows the official image choice contract and carries only re-encoded image bytes', async () => {
  const bytes = sample();
  const { submit, calls } = system(async request => {
    assert.equal(request.method, 'POST');
    assert.equal(request.path, ENDPOINT);
    assert.equal(request.path, '/v1/decisions');
    assert.equal(request.body.model, 'gpt-6-luna');
    assert.deepEqual(Object.keys(request.body), ['model', 'input', 'prompt_cache_options', 'questions']);
    assert.deepEqual(request.body.prompt_cache_options, { mode: 'explicit' });
    const [message] = request.body.input;
    const [image] = message.content;
    assert.equal(message.role, 'user');
    assert.equal(image.type, 'input_image');
    assert.equal(image.image_url, 'data:image/png;base64,' + Buffer.from(bytes).toString('base64'));
    assert.equal(request.body.questions[0].type, 'choice');
    assert.deepEqual(request.body.questions[0].choices.map(choice => choice.value), ['allow', 'retake']);
    assert.doesNotMatch(JSON.stringify(request.body.questions), /fixtureName|auth|key-file/i);
    return mockAnswer('allow');
  });
  assert.deepEqual(await submit(bytes), { outcome: 'allow', reason: 'policy_pass' });
  assert.equal(calls.transport, 1);
  assert.deepEqual(calls.disk, [new Uint8Array(bytes)]);
  assert.deepEqual(calls.shared, calls.disk);
  assert.deepEqual(calls.animation, calls.disk);
});

for (const fixture of fixtures) {
  test('synthetic fixture: ' + fixture.name, async () => {
    const { submit, calls } = system(async () => mockAnswer(fixture.expected));
    assert.equal((await submit(fixture.image())).outcome, fixture.expected);
    assert.equal(calls.transport, 1);
    if (fixture.expected === 'retake') noEffects(calls);
    else assert.equal(calls.disk.length + calls.shared.length + calls.animation.length, 3);
  });
}

test('both switches default closed, and a locally uncertain image never reaches the transport', async () => {
  const classify = createDrawingClassifier({ transport: () => assert.fail('disabled classifier dispatched') });
  assert.deepEqual(await classify(sample()), { outcome: 'retake', reason: 'disabled' });
  const disabled = createScreenedSubmission({ prepare: () => assert.fail('disabled submission prepared') });
  assert.deepEqual(await disabled(sample()), { outcome: 'retake', reason: 'disabled' });
  for (const opts of [{ submissionEnabled: false }, { providerEnabled: false }, { localOutcome: 'uncertain' }]) {
    const { submit, calls } = system(async () => assert.fail('blocked input reached transport'), opts);
    assert.equal((await submit(sample())).outcome, 'retake');
    assert.equal(calls.transport, 0);
    noEffects(calls);
  }
});

test('unsupported or oversized bytes, truncated headers and excessive dimensions are rejected before transport', async () => {
  const tooWide = sample();
  tooWide.writeUInt32BE(1025, 16);
  const { submit, calls } = system(async () => assert.fail('invalid bytes reached transport'));
  for (const bytes of [new Uint8Array(5), Buffer.from('not a png'), sample().subarray(0, 30),
    new Uint8Array(1024 * 1024 + 1), tooWide]) {
    assert.equal((await submit(bytes)).reason, 'invalid_prepared_png');
  }
  assert.equal(calls.transport, 0);
  noEffects(calls);
});

test('the parser closes on malformed, contradictory, or low-confidence answers and provider refusals', async () => {
  const good = () => mockAnswer('allow');
  const cases = [
    [{ status: 200, body: { model: MODEL, answers: [] } }, 'malformed_answer'],
    [{ status: 200, body: 'not-json' }, 'malformed_answer'],
    [{ status: 200, body: { model: 'unexpected', answers: good().body.answers } }, 'malformed_answer'],
    [{ status: 200, body: { model: MODEL, answers: [{ type: 'choice', name: 'drawing_only',
      choice: 'allow', confidence: 0.98, probabilities: [
        { value: 'allow', probability: 0.99 }, { value: 'allow', probability: 0.01 },
      ] }] } }, 'malformed_answer'],
    [{ status: 200, body: { model: MODEL, answers: [{ ...good().body.answers[0], choice: 'retake' }] } }, 'malformed_answer'],
    [{ status: 200, body: { model: MODEL, answers: [{ ...good().body.answers[0], confidence: 0.3 }] } }, 'uncertain'],
    [{ status: 200, body: { model: MODEL, answers: [good().body.answers[0], good().body.answers[0]] } }, 'malformed_answer'],
    [{ status: 200, body: { model: MODEL, answers: [{ type: 'refusal', name: 'drawing_only' }] } }, 'provider_refusal'],
    [mockAnswer('allow', 0.8), 'uncertain'],
    [{ status: 429, body: good().body }, 'provider_http'],
    [{ status: 503, body: good().body }, 'provider_http'],
  ];
  for (const [reply, reason] of cases) {
    const { submit, calls } = system(async () => reply);
    assert.deepEqual(await submit(sample()), { outcome: 'retake', reason });
    assert.equal(calls.transport, 1);
    noEffects(calls);
  }
});

test('a transport exception does not disclose provider text or retry', async () => {
  const { submit, calls } = system(async () => { throw new Error('untrusted provider detail'); });
  assert.deepEqual(await submit(sample()), { outcome: 'retake', reason: 'provider_unavailable' });
  assert.equal(calls.transport, 1);
  noEffects(calls);
});

test('timeout aborts transport, and a late allow cannot open any sink', async () => {
  let finish;
  const { submit, calls, signal } = system(
    () => new Promise(resolve => { finish = resolve; }), { timeoutMs: 15 },
  );
  assert.deepEqual(await submit(sample()), { outcome: 'retake', reason: 'timeout' });
  assert.equal(signal().aborted, true);
  finish(mockAnswer('allow'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.transport, 1);
  noEffects(calls);
});

test('approval preserves the exact normalized byte snapshot even if the original buffer changes', async () => {
  const original = sample();
  const snapshot = new Uint8Array(original);
  const { submit, calls } = system(async () => {
    original.fill(0);
    return mockAnswer('allow');
  });
  assert.equal((await submit(original)).outcome, 'allow');
  assert.deepEqual(calls.disk, [snapshot]);
});

test('a guessed allow from outside the adapter cannot open the approved sink', async () => {
  const submit = createScreenedSubmission({
    enabled: true, prepare: async () => ({ outcome: 'clear', bytes: sample() }),
    classify: async () => ({ outcome: 'allow', reason: 'policy_pass' }),
    onApproved: () => assert.fail('unverified allow opened the sink'),
  });
  assert.equal((await submit(null)).outcome, 'retake');
});

test('host preparation exceptions and unexpected classifier details fail closed without leaking text', async () => {
  let transportCalls = 0;
  const classify = createDrawingClassifier({
    enabled: true, transport: () => { transportCalls++; },
  });
  const onApproved = () => assert.fail('screening failure opened the sink');
  const prepareFails = createScreenedSubmission({
    enabled: true, classify, onApproved,
    prepare: () => { throw new Error('private preparation error'); },
  });
  const invalidResult = createScreenedSubmission({
    enabled: true, onApproved,
    prepare: () => ({ outcome: 'clear', bytes: sample() }),
    classify: () => ({ outcome: 'retake', reason: 'untrusted text', raw: 'untrusted content' }),
  });
  for (const submit of [prepareFails, invalidResult]) {
    assert.deepEqual(await submit(sample()), { outcome: 'retake', reason: 'screening_unavailable' });
  }
  assert.equal(transportCalls, 0);
});

test('benchmark counts safe and blocked results separately and distinguishes high-risk and stand-ins', async () => {
  let index = 0;
  const result = await runSyntheticBenchmark({
    enabled: true,
    transport: async () => mockAnswer(index++ === 0 ? 'retake' : 'allow'),
  });
  assert.equal(result.model, MODEL);
  assert.equal(result.transportAttempts, 8);
  assert.equal(result.safeAllowed, 1);
  assert.equal(result.safeFalseRetakes, 1);
  assert.equal(result.blockedFalseApprovals, 6);
  assert.equal(result.highRiskFalseApprovals, 3);
  assert.equal(result.harmlessStandInFalseApprovals, 1);
});

test('benchmark stops on the first infrastructure failure and cannot send more than twenty', async () => {
  const result = await runSyntheticBenchmark({ enabled: true, transport: async () => ({ status: 429 }) });
  assert.equal(result.transportAttempts, 1);
  assert.equal(result.evaluated, 0);
  assert.deepEqual(result.failures, { provider_http: 1 });
  assert.equal(result.stopped, 'provider_http');
  assert.ok(fixtures.length <= 20);
});

test('CLI defaults to disabled and accepts only an offline mock run', () => {
  const cli = fileURLToPath(new URL('./benchmark.mjs', import.meta.url));
  assert.deepEqual(JSON.parse(execFileSync(process.execPath, [cli], { encoding: 'utf8' })),
    { mode: 'disabled', model: MODEL, liveRequests: 0 });
  const result = JSON.parse(execFileSync(process.execPath, [cli, '--mock'], { encoding: 'utf8' }));
  assert.deepEqual([result.mode, result.liveRequests, result.transportAttempts, result.evaluated], ['mock', 0, 8, 8]);
  assert.throws(() => execFileSync(process.execPath, [cli, '--live'], { stdio: 'pipe' }), { status: 2 });
});
