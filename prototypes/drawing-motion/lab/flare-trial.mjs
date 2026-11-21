import { GIF_LIMIT, preview } from './server.mjs';

const endpoint = 'https://api.openai.com/v1/images/edits';
const maxReplyBytes = Math.ceil(GIF_LIMIT / 3) * 4 + 16 * 1024;
const maxDeadlineMs = 120000;
const closed = reason => ({ kind: 'local', reason });

async function readAnswer(response, signal) {
  const type = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (response.status !== 200 || response.redirected || type !== 'application/json' || !response.body) {
    if (response.body) void response.body.cancel().catch(() => {});
    throw new Error('Unexpected image edit response.');
  }

  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    signal.throwIfAborted();
    size += chunk.byteLength;
    if (size > maxReplyBytes) throw new Error('Image edit response too large.');
    chunks.push(chunk);
  }
  const answer = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)));
  if (!answer || answer.error || answer.refusal || answer.data?.[0]?.error || answer.data?.[0]?.refusal) {
    throw new Error('Image edit was not accepted.');
  }
  return answer;
}

/**
 * Creates one private trial of the checked-in synthetic fixture. The operator's
 * approved runner supplies fetch and the project credential after reserving the
 * request. This module never reads environment state or accepts user images.
 */
export function createFlareGifTrial({
  enabled = false,
  reservedRequests = 0,
  apiKey,
  fetchImpl,
  timeoutMs = maxDeadlineMs,
} = {}) {
  let attempted = false;
  return async () => {
    if (enabled !== true) return closed('disabled');
    if (reservedRequests !== 1) return closed('reservation_required');
    if (typeof apiKey !== 'string' || !/^[!-~]{1,4096}$/.test(apiKey) ||
        typeof fetchImpl !== 'function' ||
        !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > maxDeadlineMs) {
      return closed('invalid_configuration');
    }
    if (attempted) return closed('already_attempted');
    // Consume the one attempt before dispatch, including timeout or uncertain failures.
    attempted = true;

    let signal;
    let answered = false;
    const result = await preview('gif', async ({ body }, options) => {
      signal = options.signal;
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
        redirect: 'error',
        cache: 'no-store',
        body,
        signal,
      });
      signal.throwIfAborted();
      const answer = await readAnswer(response, signal);
      answered = true;
      return answer;
    }, timeoutMs);

    if (result.kind === 'gif') return result;
    if (signal?.aborted) return closed('timeout');
    return closed(answered ? 'invalid_gif' : 'provider_failure');
  };
}
