import qrCode from 'qrcode-generator';
import { drawPreset, labels } from './drawings.mjs';
import { assets, classroomScriptPolicy } from 'little-pencil-assets';

const sessionCookie = '__Host-lpc-class';
const tokenPattern = /^[a-f0-9]{64}$/;
const classRoute = /^\/classes\/([a-f0-9]{32})(?:\/(invite|drawings)(?:\/([a-f0-9]{32}))?)?$/;
const imageRoute = /^\/images\/([a-f0-9]{32})(\/report)?$/;
const maxWrites = 12;
const maxDrawings = 24;
const maxPerMember = 2;
const maxMembers = 48;
const maxClasses = 4;
const classTtl = 86400;
const inviteTtl = 7200;
const writeLease = 120;
const now = () => Math.floor(Date.now() / 1000);
const classHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, noimageindex',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': classroomScriptPolicy,
};
const memberScope = "FROM memberships m JOIN invites i ON i.id = m.invite_id JOIN classes c ON c.id = i.class_id";
const memberWhere = 'm.token_hash = ? AND m.expires_at > ? AND i.expires_at > ? AND i.revoked_at IS NULL AND c.expires_at > ?';

function randomHex(length) {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), n => n.toString(16).padStart(2, '0')).join('');
}

async function digest(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { ...classHeaders, ...headers } });
}

function problem(status, error) {
  return json({ error }, status);
}

function noContent(headers = {}) {
  return new Response(null, { status: 204, headers: { ...classHeaders, ...headers } });
}

function enabled(env) {
  return env.CLASSROOM_SYNTHETIC_ENABLED === '1'
    && typeof env.DB?.prepare === 'function' && typeof env.BUCKET?.put === 'function'
    && typeof env.BUCKET?.get === 'function' && typeof env.BUCKET?.delete === 'function'
    && typeof env.BUCKET?.list === 'function';
}

function adminId(request, env) {
  const identity = request.headers.get('oai-authenticated-user-id');
  return identity && identity === env.CLASSROOM_ADMIN_USER_ID ? identity : null;
}

function makeCookie(token, age) {
  return sessionCookie + '=' + token + '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=' + age;
}

async function sessionHash(request) {
  const parts = (request.headers.get('cookie') || '').split(';').map(part => part.trim());
  const matches = parts.filter(part => part.startsWith(sessionCookie + '='));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(sessionCookie.length + 1);
  return tokenPattern.test(token) ? digest(token) : null;
}

function member(db, session, time) {
  return db.prepare('SELECT m.id, c.id AS class_id, c.expires_at AS class_expires ' + memberScope + ' WHERE ' + memberWhere)
    .bind(session, time, time, time).first();
}

async function smallJson(request) {
  if (request.headers.get('content-type') !== 'application/json' || !request.body) return null;
  const reader = request.body.getReader();
  const bytes = new Uint8Array(128);
  let position = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, position)));
      if (position + value.length > bytes.length) {
        await reader.cancel();
        return null;
      }
      bytes.set(value, position);
      position += value.length;
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

async function emptyBody(request) {
  if (!request.body) return true;
  const reader = request.body.getReader();
  try {
    const { done } = await reader.read();
    if (!done) await reader.cancel();
    return done;
  } finally {
    reader.releaseLock();
  }
}

function hasOnly(body, property) {
  return body && typeof body === 'object' && Object.keys(body).length === 1 && Object.hasOwn(body, property);
}

async function join(request, db) {
  const body = await smallJson(request);
  if (!hasOnly(body, 'invite') || typeof body.invite !== 'string' || !tokenPattern.test(body.invite)) {
    return problem(400, 'Use the private class QR.');
  }

  const time = now();
  const hash = await digest(body.invite);
  const prior = await sessionHash(request);
  if (prior) {
    const alreadyJoined = await db.prepare('SELECT 1 ' + memberScope + ' WHERE ' + memberWhere + ' AND i.token_hash = ?')
      .bind(prior, time, time, time, hash).first();
    if (alreadyJoined) return noContent();
  }
  const session = randomHex(32);
  const sessionId = randomHex(16);
  const result = await db.prepare(
    'INSERT INTO memberships (id, invite_id, token_hash, created_at, expires_at) ' +
    'SELECT ?, i.id, ?, ?, MIN(i.expires_at, c.expires_at, ?) FROM invites i ' +
    'JOIN classes c ON c.id = i.class_id WHERE i.token_hash = ? AND i.revoked_at IS NULL ' +
    'AND i.expires_at > ? AND c.expires_at > ? AND (SELECT COUNT(*) FROM memberships m ' +
    'WHERE m.invite_id = i.id AND m.expires_at > ?) < ? RETURNING expires_at',
  ).bind(sessionId, await digest(session), time, time + inviteTtl, hash, time, time, time, maxMembers).first();
  if (!result) return problem(404, 'This class QR is unavailable or full. Ask the grown-up who shared it.');
  return noContent({ 'Set-Cookie': makeCookie(session, result.expires_at - time) });
}

async function submit(request, db, bucket, session) {
  const body = await smallJson(request);
  if (!hasOnly(body, 'preset') || typeof body.preset !== 'string') {
    return problem(400, 'Choose a sample drawing.');
  }
  if (!Object.hasOwn(labels, body.preset)) {
    return problem(422, 'The sample did not pass screening. Try a different sample.');
  }

  // Only known, server-generated artwork passes this synthetic policy. No original upload is accepted.
  const bytes = await drawPreset(body.preset);
  if (bytes.byteLength > 16384) return problem(503, 'The sample drawing is unavailable.');
  const id = randomHex(16);
  const key = objectKey(id);
  const time = now();
  const reserved = await db.prepare(
    "INSERT INTO drawings (id, class_id, membership_id, label, state, created_at, expires_at) " +
    "SELECT ?, c.id, m.id, ?, 'writing', ?, MIN(c.expires_at, ?) " + memberScope +
    ' WHERE ' + memberWhere +
    ' AND (SELECT COUNT(*) FROM drawings WHERE class_id = c.id) < ?' +
    " AND (SELECT COUNT(*) FROM drawings WHERE class_id = c.id AND state = 'writing') < ?" +
    " AND (SELECT COUNT(*) FROM drawings WHERE class_id = c.id AND membership_id = m.id AND state = 'writing') < ?" +
    ' RETURNING id',
  ).bind(id, labels[body.preset], time, time + classTtl, session, time, time, time,
    maxDrawings, maxWrites, maxPerMember).first();
  if (!reserved) return problem(409, 'This class is full or unavailable.');

  try {
    await bucket.put(key, bytes, { httpMetadata: { contentType: 'image/png', cacheControl: 'private, no-store' } });
    const finishedAt = now();
    const published = await db.prepare(
      "UPDATE drawings SET state = 'approved' WHERE id = ? AND state = 'writing' AND expires_at > ? " +
      'AND created_at > ? AND EXISTS (SELECT 1 ' + memberScope + ' WHERE ' + memberWhere + ') RETURNING id',
    ).bind(id, finishedAt, finishedAt - writeLease, session, finishedAt, finishedAt, finishedAt).first();
    if (published) return json({ state: 'approved' }, 201);
    await discard(db, bucket, id);
    return problem(409, 'The class session ended before the drawing was submitted.');
  } catch {
    // A removed row is a durable retry marker if the object delete also fails.
    await discard(db, bucket, id).catch(() => {});
    return problem(503, 'The drawing could not be sent. Try again later.');
  }
}

async function discard(db, bucket, id) {
  await db.prepare("UPDATE drawings SET state = 'removed' WHERE id = ?").bind(id).run();
  await bucket.delete(objectKey(id));
  await db.prepare("DELETE FROM drawings WHERE id = ? AND state = 'removed'").bind(id).run();
}

function objectKey(id) {
  return 'classroom/v1/' + id + '.png';
}

async function servePng(db, bucket, id, authorize) {
  if (!(await authorize(db, now()))) return problem(404, 'Drawing unavailable.');
  const drawing = await bucket.get(objectKey(id));
  if (!drawing || drawing.size > 16384 || !(await authorize(db, now()))) {
    if (drawing) await drawing.body.cancel();
    return problem(404, 'Drawing unavailable.');
  }
  return new Response(drawing.body, {
    headers: { ...classHeaders, 'Content-Type': 'image/png', 'Content-Disposition': 'inline' },
  });
}

async function readMemberImage(db, bucket, id, session) {
  return servePng(db, bucket, id, (db, time) => db.prepare(
    'SELECT 1 ' + memberScope + " JOIN drawings d ON d.class_id = c.id AND d.state = 'approved' " +
    'WHERE ' + memberWhere + ' AND d.id = ? AND d.expires_at > ?',
  ).bind(session, time, time, time, id, time).first());
}

async function createClass(db, owner) {
  const time = now();
  const existing = await db.prepare(
    'INSERT INTO classes (id, owner_id, created_at, expires_at) SELECT ?, ?, ?, ? ' +
    'WHERE (SELECT COUNT(*) FROM classes) < ? RETURNING id, expires_at',
  ).bind(randomHex(16), owner, time, time + classTtl, maxClasses).first();
  return existing ? json(existing, 201) : problem(409, 'Clear expired samples before creating another class.');
}

async function rotateInvite(request, db, classId, owner) {
  const time = now();
  const token = randomHex(32);
  const url = new URL('/classroom', request.url);
  url.hash = token;
  const qr = qrCode(0, 'M');
  qr.addData(url.href);
  qr.make();
  const modules = Array.from({ length: qr.getModuleCount() }, (_, y) =>
    Array.from({ length: qr.getModuleCount() }, (_, x) => qr.isDark(y, x) ? '1' : '0').join(''));
  const [, , inserted] = await db.batch([
    db.prepare('DELETE FROM invites WHERE class_id = ? AND revoked_at IS NOT NULL ' +
      'AND EXISTS (SELECT 1 FROM classes WHERE id = ? AND owner_id = ? AND expires_at > ?)')
      .bind(classId, classId, owner, time),
    db.prepare('UPDATE invites SET revoked_at = ? WHERE class_id = ? AND revoked_at IS NULL ' +
      'AND EXISTS (SELECT 1 FROM classes WHERE id = ? AND owner_id = ? AND expires_at > ?)')
      .bind(time, classId, classId, owner, time),
    db.prepare('INSERT INTO invites (id, class_id, token_hash, created_at, expires_at) ' +
      'SELECT ?, id, ?, ?, MIN(?, expires_at) FROM classes WHERE id = ? AND owner_id = ? AND expires_at > ? ' +
      'RETURNING expires_at')
      .bind(randomHex(16), await digest(token), time, time + inviteTtl, classId, owner, time),
  ]);
  if (!inserted.results.length) return problem(404, 'Class unavailable.');
  return json({ url: url.href, modules, expires_at: inserted.results[0].expires_at }, 201);
}

async function purgeExpired(db, bucket) {
  const time = now();
  const stale = await db.prepare("SELECT id FROM drawings WHERE state = 'removed' OR expires_at <= ? " +
    "OR (state = 'writing' AND created_at <= ?) LIMIT 96").bind(time, time - writeLease).all();
  const staleIds = stale.results.map(({ id }) => id);
  if (staleIds.length) {
    const positions = staleIds.map(() => '?').join(', ');
    await db.prepare("UPDATE drawings SET state = 'removed' WHERE id IN (" + positions + ')')
      .bind(...staleIds).run();
    await bucket.delete(staleIds.map(objectKey));
    await db.prepare("DELETE FROM drawings WHERE state = 'removed' AND id IN (" + positions + ')')
      .bind(...staleIds).run();
  }

  // Also catch a write that finished after its expired reservation was reclaimed.
  const objects = await bucket.list({ prefix: 'classroom/v1/', limit: 250 });
  const candidates = objects.objects.flatMap(object => {
    const id = /^classroom\/v1\/([a-f0-9]{32})\.png$/.exec(object.key)?.[1];
    return id && object.uploaded.getTime() <= (time - writeLease) * 1000 ? [id] : [];
  });
  for (let offset = 0; offset < candidates.length; offset += 80) {
    const ids = candidates.slice(offset, offset + 80);
    const existing = await db.prepare('SELECT id FROM drawings WHERE id IN (' + ids.map(() => '?').join(', ') + ')')
      .bind(...ids).all();
    const liveIds = new Set(existing.results.map(({ id }) => id));
    const orphans = ids.filter(id => !liveIds.has(id));
    if (orphans.length) await bucket.delete(orphans.map(objectKey));
  }
  await db.batch([
    db.prepare('DELETE FROM memberships WHERE expires_at <= ?').bind(time),
    db.prepare('DELETE FROM invites WHERE expires_at <= ?').bind(time),
    db.prepare('DELETE FROM classes WHERE expires_at <= ? ' +
      'AND NOT EXISTS (SELECT 1 FROM drawings WHERE drawings.class_id = classes.id)').bind(time),
  ]);
}

async function review(request, db, bucket, path, owner) {
  if (!owner) return problem(404, 'Class unavailable.');
  const time = now();
  if (path === '/classes') {
    if (request.method === 'POST' && await emptyBody(request)) return createClass(db, owner);
    if (request.method === 'GET') {
      const classes = await db.prepare('SELECT id, expires_at FROM classes WHERE owner_id = ? AND expires_at > ? ORDER BY created_at, id')
        .bind(owner, time).all();
      return json(classes.results);
    }
  }
  if (path === '/cleanup' && request.method === 'POST' && await emptyBody(request)) {
    await purgeExpired(db, bucket);
    return noContent();
  }

  const [, classId, section, id] = classRoute.exec(path) || [];
  if (!classId) return problem(404, 'Class unavailable.');
  const owns = () => db.prepare('SELECT 1 FROM classes WHERE id = ? AND owner_id = ? AND expires_at > ?')
    .bind(classId, owner, now()).first();
  if (!(await owns())) return problem(404, 'Class unavailable.');

  if (section === 'invite' && !id && await emptyBody(request)) {
    if (request.method === 'POST') return rotateInvite(request, db, classId, owner);
    if (request.method === 'DELETE') {
      await db.prepare('UPDATE invites SET revoked_at = ? WHERE class_id = ? AND revoked_at IS NULL ' +
        'AND EXISTS (SELECT 1 FROM classes WHERE id = ? AND owner_id = ? AND expires_at > ?)')
        .bind(time, classId, classId, owner, time).run();
      return noContent();
    }
  }

  if (section === 'drawings') {
    if (!id && request.method === 'GET') {
      const drawings = await db.prepare('SELECT d.id, d.label, d.state FROM drawings d JOIN classes c ON c.id = d.class_id ' +
        "WHERE c.id = ? AND c.owner_id = ? AND c.expires_at > ? AND d.expires_at > ? AND d.state IN ('approved', 'reported') " +
        "ORDER BY d.state DESC, d.created_at, d.id").bind(classId, owner, time, time).all();
      return json(drawings.results);
    }
    if (id && request.method === 'GET') {
      return servePng(db, bucket, id, (db, currentTime) => db.prepare(
        'SELECT 1 FROM drawings d JOIN classes c ON c.id = d.class_id ' +
        "WHERE d.id = ? AND c.id = ? AND c.owner_id = ? AND d.state IN ('approved', 'reported') AND c.expires_at > ? AND d.expires_at > ?",
      ).bind(id, classId, owner, currentTime, currentTime).first());
    }
    if (id && await emptyBody(request) && request.method === 'DELETE') {
      const removed = await db.prepare("UPDATE drawings SET state = 'removed' WHERE id = ? AND class_id = ? " +
        "AND state IN ('approved', 'reported', 'removed') AND EXISTS (SELECT 1 FROM classes WHERE id = ? AND owner_id = ? AND expires_at > ?) " +
        'RETURNING id').bind(id, classId, classId, owner, time).first();
      if (!removed) return problem(404, 'Drawing unavailable.');
      await discard(db, bucket, id);
      return noContent();
    }
  }
  return problem(404, 'Class unavailable.');
}

async function galleryApi(request, env, url) {
  if (!enabled(env)) return problem(503, 'The sample classroom is unavailable.');
  const method = request.method;
  const isRead = method === 'GET';
  const fetchSite = request.headers.get('sec-fetch-site');
  if ((fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') ||
    (!isRead && request.headers.get('origin') !== url.origin)) return problem(403, 'Open the gallery directly.');
  if (!['GET', 'POST', 'DELETE'].includes(method)) return problem(405, 'Method unavailable.');

  const db = typeof env.DB.withSession === 'function' ? env.DB.withSession('first-primary') : env.DB;
  const path = url.pathname.slice('/classroom/api'.length);
  const owner = adminId(request, env);
  if (path === '/join' && method === 'POST') return join(request, db);
  if (path === '/leave' && method === 'POST' && await emptyBody(request)) {
    const hash = await sessionHash(request);
    if (hash) await db.prepare('DELETE FROM memberships WHERE token_hash = ?').bind(hash).run();
    return noContent({ 'Set-Cookie': makeCookie('', 0) });
  }
  if (path.startsWith('/classes') || path === '/cleanup') return review(request, db, env.BUCKET, path, owner);

  const match = imageRoute.exec(path);
  if (path !== '/gallery' && path !== '/submit' && !match) return problem(404, 'Class unavailable.');
  const session = await sessionHash(request);
  const time = now();
  if (!session || !(await member(db, session, time))) return problem(404, 'Join with the private class QR.');
  if (path === '/gallery' && isRead) {
    const drawings = await db.prepare('SELECT d.id, d.label ' + memberScope +
      " JOIN drawings d ON d.class_id = c.id AND d.state = 'approved' WHERE " + memberWhere +
      ' AND d.expires_at > ? ORDER BY d.created_at, d.id').bind(session, time, time, time, time).all();
    return json(drawings.results);
  }
  if (path === '/submit' && method === 'POST') return submit(request, db, env.BUCKET, session);
  if (match && !match[2] && isRead) return readMemberImage(db, env.BUCKET, match[1], session);
  if (match?.[2] && method === 'POST' && await emptyBody(request)) {
    const reported = await db.prepare("UPDATE drawings SET state = 'reported' WHERE id = ? AND state = 'approved' " +
      'AND expires_at > ? AND EXISTS (SELECT 1 ' + memberScope + ' WHERE ' + memberWhere +
      ' AND c.id = drawings.class_id) RETURNING id')
      .bind(match[1], time, session, time, time, time).first();
    return reported ? noContent() : problem(404, 'Drawing unavailable.');
  }
  return problem(405, 'Method unavailable.');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const privatePath = path === '/classroom' || path.startsWith('/classroom/');
    if (path === '/classroom/' || (path === '/classroom' && url.search)) {
    return new Response(null, { status: 302, headers: { ...classHeaders, Location: '/classroom' } });
  }
  if (path.startsWith('/classroom/api/')) {
      try {
        return await galleryApi(request, env, url);
      } catch {
        return problem(503, 'The sample classroom is temporarily unavailable.');
      }
    }

    const asset = assets[path];
    if (!Object.hasOwn(assets, path) || !['GET', 'HEAD'].includes(request.method)) {
      return new Response('Page unavailable.', { status: 404, headers: privatePath ? classHeaders : {} });
    }
    return new Response(request.method === 'GET' ? asset.content : null, {
      headers: {
        ...(privatePath ? classHeaders : { 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }),
        'Content-Type': asset.type,
      },
    });
  },

  async scheduled(_event, env) {
    if (enabled(env)) await purgeExpired(env.DB, env.BUCKET);
  },
};
