import { pathToFileURL } from 'node:url';
import { createDrawingClassifier, MODEL } from './decisions.mjs';
import { fixtures } from './synthetic-fixtures.mjs';

const stopReasons = new Set(['provider_http', 'malformed_answer', 'provider_unavailable', 'timeout',
  'disabled', 'invalid_configuration', 'invalid_prepared_png']);
const limit = 20;

export function mockAnswer(outcome, probability = 0.99) {
  return {
    status: 200,
    body: {
      model: MODEL,
      answers: [{
        type: 'choice',
        name: 'drawing_only',
        choice: outcome,
        confidence: 2 * probability - 1,
        probabilities: [
          { value: outcome, probability },
          { value: outcome === 'allow' ? 'retake' : 'allow', probability: 1 - probability },
        ],
      }],
    },
  };
}

/** Offline unless the caller explicitly supplies an approved transport. Never retries. */
export async function runSyntheticBenchmark({ enabled = false, transport, timeoutMs } = {}) {
  const summary = {
    model: MODEL,
    fixtureCount: fixtures.length,
    transportAttempts: 0,
    evaluated: 0,
    allowed: 0,
    retake: 0,
    safeAllowed: 0,
    safeFalseRetakes: 0,
    blockedRetakes: 0,
    blockedFalseApprovals: 0,
    highRiskFalseApprovals: 0,
    harmlessStandInFalseApprovals: 0,
    failures: {},
    stopped: null,
  };
  if (enabled !== true || typeof transport !== 'function') {
    summary.stopped = 'disabled';
    return summary;
  }
  if (fixtures.length > limit) throw new Error('Synthetic batch exceeds the one-run request limit.');

  const classify = createDrawingClassifier({
    enabled: true, timeoutMs,
    transport(request) {
      if (summary.transportAttempts >= limit) throw new Error('Request limit reached.');
      summary.transportAttempts++;
      return transport(request);
    },
  });

  for (const fixture of fixtures) {
    const { outcome, reason } = await classify(fixture.image());
    if (stopReasons.has(reason)) {
      summary.failures[reason] = (summary.failures[reason] ?? 0) + 1;
      summary.stopped = reason;
      break;
    }

    summary.evaluated++;
    if (outcome === 'allow') summary.allowed++;
    else summary.retake++;
    if (fixture.expected === 'allow') {
      if (outcome === 'allow') summary.safeAllowed++;
      else summary.safeFalseRetakes++;
    } else if (outcome === 'retake') {
      summary.blockedRetakes++;
    } else {
      summary.blockedFalseApprovals++;
      if (fixture.highRisk) summary.highRiskFalseApprovals++;
      if (fixture.standIn) summary.harmlessStandInFalseApprovals++;
    }
  }
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flags = process.argv.slice(2);
  if (flags.length === 1 && flags[0] === '--mock') {
    let cursor = 0;
    const summary = await runSyntheticBenchmark({
      enabled: true,
      transport: async () => mockAnswer(fixtures[cursor++].expected),
    });
    console.log(JSON.stringify({ mode: 'mock', liveRequests: 0, ...summary }, null, 2));
  } else if (flags.length === 0) {
    console.log(JSON.stringify({ mode: 'disabled', model: MODEL, liveRequests: 0 }));
  } else {
    console.error('Only --mock is available. This branch contains no live HTTP transport.');
    process.exitCode = 2;
  }
}
