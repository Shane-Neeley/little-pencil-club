import { normalizeCompleted, SCHEMA_VERSION } from './lessons.mjs';

const RETENTION_SECONDS = 30 * 24 * 60 * 60;
const MAX_RECORDS = 1000;
const MAX_BODY_BYTES = 1024;
const WINDOW_SECONDS = 60;
const limits = new Map([['save', 20], ['restore', 60], ['revoke', 20]]);
const basePath = '/progress-backup/v1/';
const codePattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const responseHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function reply(status, body, extraHeaders) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...responseHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function unavailable() {
  return reply(404, { error: 'Backup unavailable.' });
}

function progressDatabase(env) {
  const db = env.PROGRESS_DB;
  if (typeof db?.prepare !== 'function' || typeof db?.withSession !== 'function') {
    throw new Error('Progress storage unavailable.');
  }
  return db;
}

async function readBody(request) {
  const declaredLength = request.headers.get('Content-Length');
  if (declaredLength !== null && Number(declaredLength) > MAX_BODY_BYTES) return null;
  if (!request.body) return null;

  const reader = request.body.getReader();
  const bytes = new Uint8Array(MAX_BODY_BYTES);
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (size + value.byteLength > bytes.byteLength) {
        await reader.cancel();
        return null;
      }
      bytes.set(value, size);
      size += value.byteLength;
    }
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

async function digestCode(code) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=$/, '');
}

// One shared bucket per action. No IP, capability, cookie, or other requester key.
async function takeRequestSlot(db, action) {
  const row = await db.prepare(`
    INSERT INTO progress_request_limits (action, window_start, attempts)
    VALUES (?1, (unixepoch() / ?2) * ?2, 1)
    ON CONFLICT(action) DO UPDATE SET
      window_start = excluded.window_start,
      attempts = CASE WHEN window_start < excluded.window_start THEN 1 ELSE attempts + 1 END
    WHERE window_start < excluded.window_start OR attempts < ?3
    RETURNING attempts
  `).bind(action, WINDOW_SECONDS, limits.get(action)).first();
  return row !== null;
}

async function purgeExpired(db) {
  return db.prepare(`
    DELETE FROM progress_backups WHERE code_digest IN (
      SELECT code_digest FROM progress_backups
      WHERE expires_at <= unixepoch() ORDER BY expires_at LIMIT 100
    )
  `).run();
}

async function save(db, body) {
  const completed = normalizeCompleted(body.completed);
  if (Object.keys(body).length !== 2 || body.version !== SCHEMA_VERSION || !completed?.length) {
    return reply(400, { error: 'Choose at least one known sample lesson.' });
  }

  const code = newCode();
  const digest = await digestCode(code);
  await purgeExpired(db);
  const row = await db.prepare(`
    INSERT INTO progress_backups (code_digest, schema_version, completed_lessons, expires_at)
    SELECT ?1, ?2, ?3, unixepoch() + ?4
    WHERE (SELECT count(*) FROM progress_backups) < ?5
    RETURNING expires_at
  `).bind(digest, SCHEMA_VERSION, JSON.stringify(completed), RETENTION_SECONDS, MAX_RECORDS).first();

  if (!row) return reply(503, { error: 'Backup storage is temporarily full.' });
  return reply(201, { code, expiresAt: new Date(row.expires_at * 1000).toISOString() });
}

async function restoreOrRevoke(db, action, body) {
  if (Object.keys(body).length !== 1 || typeof body.code !== 'string' || !codePattern.test(body.code)) {
    return unavailable();
  }

  const digest = await digestCode(body.code);
  // Each restore starts with fresh data even when it arrives from a different device.
  const session = db.withSession('first-primary');
  if (action === 'revoke') {
    const removed = await session.prepare(`
      DELETE FROM progress_backups WHERE code_digest = ? AND expires_at > unixepoch()
      RETURNING schema_version
    `).bind(digest).first();
    if (!removed) return unavailable();

    // The same session sees the committed DELETE before we acknowledge it.
    const remaining = await session.prepare('SELECT 1 FROM progress_backups WHERE code_digest = ?')
      .bind(digest).first();
    if (remaining) throw new Error('Progress backup deletion could not be verified.');
    return reply(204, null);
  }

  const row = await session.prepare(`
    SELECT schema_version, completed_lessons FROM progress_backups
    WHERE code_digest = ? AND expires_at > unixepoch()
  `).bind(digest).first();
  if (!row || row.schema_version !== SCHEMA_VERSION) return unavailable();
  const completed = normalizeCompleted(JSON.parse(row.completed_lessons));
  if (!completed?.length) return unavailable();
  return reply(200, { version: SCHEMA_VERSION, completed });
}

export default {
  async fetch(request, env) {
    if (env?.PROGRESS_BACKUP_ENABLED !== 'true') return unavailable();

    const url = new URL(request.url);
    const action = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) : '';
    if (!limits.has(action) || request.url.includes('?')) return unavailable();
    if (request.method !== 'POST') return reply(405, { error: 'Method unavailable.' }, { Allow: 'POST' });
    if (url.protocol !== 'https:' || request.headers.get('Origin') !== url.origin) return unavailable();
    const fetchSite = request.headers.get('Sec-Fetch-Site');
    if (fetchSite !== null && fetchSite !== 'same-origin') return unavailable();
    if (request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      return reply(415, { error: 'Use a JSON request.' });
    }

    try {
      const db = progressDatabase(env);
      if (!(await takeRequestSlot(db, action))) {
        return reply(429, { error: 'Wait a minute and try again.' }, { 'Retry-After': String(WINDOW_SECONDS) });
      }
      const body = await readBody(request);
      if (!body) return reply(400, { error: 'Invalid backup request.' });
      return action === 'save' ? await save(db, body) : await restoreOrRevoke(db, action, body);
    } catch {
      return reply(503, { error: 'Backup service unavailable.' });
    }
  },

  async scheduled(_controller, env) {
    if (env?.PROGRESS_BACKUP_ENABLED !== 'true') return;
    try {
      await purgeExpired(progressDatabase(env));
    } catch {
      throw new Error('Progress backup cleanup unavailable.');
    }
  },
};
