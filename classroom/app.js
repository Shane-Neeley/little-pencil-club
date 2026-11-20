'use strict';

const get = id => document.getElementById(id);
const message = text => { get('status').textContent = text; };
const api = '/classroom/api';
const review = location.pathname === '/classroom/review';
let invite = window.classroomInvitation;
delete window.classroomInvitation;
let selected;
let classes = [];

async function call(path, method = 'GET', body) {
  const options = { method, credentials: 'same-origin', cache: 'no-store', redirect: 'error' };
  if (body) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(api + path, options);
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
  return data;
}

function createButton(text, action, plain = false, disabled = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.disabled = disabled;
  if (plain) button.className = 'plain';
  button.addEventListener('click', () => act(button, action));
  return button;
}

function hideInvite() {
  get('invite').hidden = true;
  get('qr-link').removeAttribute('href');
  get('qr').width = 0;
}

function card(drawing, imagePath, mayReview) {
  const node = document.createElement('article');
  const image = document.createElement('img');
  image.src = api + imagePath;
  image.alt = drawing.label;
  image.width = 192;
  image.height = 132;
  const name = document.createElement('p');
  name.textContent = drawing.label;
  node.append(image, name);

  if (mayReview) {
    const controls = document.createElement('div');
    controls.className = 'actions';
    if (drawing.state === 'reported') {
      const reported = document.createElement('p');
      reported.textContent = 'Reported · hidden from class';
      node.append(reported);
    }
    controls.append(createButton('Remove', () => removeDrawing(imagePath), true));
    node.append(controls);
  } else {
    node.append(createButton('Report', async () => {
      await call(imagePath + '/report', 'POST');
      await refreshGallery();
      message('Drawing reported and hidden.');
    }, true));
  }
  return node;
}

async function refreshGallery() {
  const drawings = await call('/gallery');
  get('member').hidden = false;
  get('qr-help').hidden = true;
  get('empty').hidden = drawings.length > 0;
  get('gallery').replaceChildren(...drawings.map(item => card(item, '/images/' + item.id, false)));
}

async function refreshClasses(wanted) {
  classes = await call('/classes');
  get('controls').hidden = false;
  selected = classes.find(item => item.id === wanted)?.id ?? classes[0]?.id;
  get('classes').replaceChildren(...classes.map((item, index) => createButton(
    'Sample class ' + (index + 1), () => refreshClasses(item.id), true, item.id === selected,
  )));
  hideInvite();
  get('class').hidden = !selected;
  if (!selected) return;
  get('class-title').textContent = 'Sample class ' + (classes.findIndex(item => item.id === selected) + 1);
  await refreshReview();
}

function classPath() {
  return '/classes/' + selected;
}

async function refreshReview() {
  const path = classPath() + '/drawings';
  const drawings = await call(path);
  get('no-review').hidden = drawings.length > 0;
  get('queue').replaceChildren(...drawings.map(item => card(item, path + '/' + item.id, true)));
}

async function removeDrawing(path) {
  await call(path, 'DELETE');
  await refreshReview();
  message('Drawing removed.');
}

function showInvite({ modules, url, expires_at }) {
  const qr = get('qr');
  const scale = 4;
  const border = 4;
  qr.width = qr.height = (modules.length + border * 2) * scale;
  const ctx = qr.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, qr.width, qr.height);
  ctx.fillStyle = '#171525';
  modules.forEach((row, y) => [...row].forEach((dark, x) => {
    if (dark === '1') ctx.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
  }));
  get('qr-link').href = url;
  get('qr-expiry').textContent = 'Sample QR expires at ' +
    new Date(expires_at * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.';
  get('invite').hidden = false;
}

async function act(button, action) {
  button.disabled = true;
  message('');
  try {
    await action();
  } catch (error) {
    if (!review && error.status === 404) {
      get('member').hidden = true;
      get('gallery').replaceChildren();
    }
    if (review && (error.status === 404 || error.status === 503)) {
      hideInvite();
      get('queue').replaceChildren();
    }
    message(error.status ? error.message : 'The sample gallery could not be reached.');
  } finally {
    button.disabled = false;
  }
}

if (review) {
  get('title').textContent = 'Class controls';
  get('gallery-link').hidden = false;
  get('review').hidden = false;
  get('new-class').onclick = event => act(event.currentTarget, async () => {
    const newClass = await call('/classes', 'POST');
    await refreshClasses(newClass.id);
  });
  get('cleanup').onclick = event => act(event.currentTarget, async () => {
    await call('/cleanup', 'POST');
    await refreshClasses(selected);
    message('Expired samples cleared.');
  });
  get('rotate').onclick = event => act(event.currentTarget, async () => {
    hideInvite();
    showInvite(await call(classPath() + '/invite', 'POST'));
  });
  get('revoke').onclick = event => act(event.currentTarget, async () => {
    hideInvite();
    await call(classPath() + '/invite', 'DELETE');
    message('Sample QR and class sessions revoked.');
  });
  refreshClasses().catch(error => {
    get('sign-in').hidden = error.status !== 404;
    message(error.status === 404 ? 'Only the configured adult can manage sample classes.' :
      'The sample classroom is unavailable.');
  });
} else {
  const inviteFormat = /^[a-f0-9]{64}$/;
  if (!inviteFormat.test(invite)) invite = undefined;
  let started = false;
  let opening = false;

  async function openClass() {
    // A visible navigation is the join action. Preloaded pages stay inert.
    if (opening || (started && !invite) || document.prerendering || document.visibilityState !== 'visible') return;
    started = true;
    opening = true;
    message('');
    try {
      const scanned = invite;
      invite = undefined;
      if (scanned) {
        get('member').hidden = true;
        get('gallery').replaceChildren();
        await call('/join', 'POST', { invite: scanned });
      }
      await refreshGallery();
    } catch (error) {
      get('qr-help').hidden = error.status !== 404;
      message(error.status === 404 ? 'Open the private class QR to join.' : 'The sample classroom is unavailable.');
    } finally {
      opening = false;
      if (invite) void openClass();
    }
  }

  // A browser can reuse this document when only an invite fragment changes.
  addEventListener('hashchange', () => {
    const scanned = location.hash.slice(1);
    history.replaceState(null, '', location.pathname);
    if (!inviteFormat.test(scanned)) return;
    invite = scanned;
    void openClass();
  });
  document.addEventListener('prerenderingchange', openClass);
  document.addEventListener('visibilitychange', openClass);
  openClass();
}

get('submit').addEventListener('submit', event => {
  event.preventDefault();
  act(event.submitter, async () => {
    await call('/submit', 'POST', { preset: get('preset').value });
    await refreshGallery();
    message('Sample passed screening and is now in the gallery.');
  });
});
get('leave').onclick = event => act(event.currentTarget, async () => {
  await call('/leave', 'POST');
  get('member').hidden = true;
  get('gallery').replaceChildren();
  message('You left the sample class on this device.');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || review || get('member').hidden) return;
  refreshGallery().catch(error => {
    get('member').hidden = true;
    get('gallery').replaceChildren();
    message(error.status === 404 ? 'Open the private class QR to rejoin.' : 'The sample classroom is unavailable.');
  });
});

addEventListener('pagehide', () => {
  hideInvite();
  get('gallery').replaceChildren();
  get('queue').replaceChildren();
});
addEventListener('pageshow', event => {
  if (event.persisted) location.reload();
});
