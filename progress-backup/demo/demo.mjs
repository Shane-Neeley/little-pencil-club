import { mergeCompleted, normalizeCompleted, SCHEMA_VERSION } from '../src/lessons.mjs';

export function activateDemo(environment) {
  const { document, localStorage } = environment;
  const key = 'little-pencil-club/progress-backup-prototype';
  const checkboxes = Array.from(document.querySelectorAll('#lessons input'));
  const buttons = Array.from(document.querySelectorAll('button[data-action]'));
  const recoverCode = document.querySelector('#recover-code');
  const newCode = document.querySelector('#new-code');
  const newBackup = document.querySelector('#new-backup');
  const status = document.querySelector('#status');

  function localCompleted() {
    const saved = localStorage.getItem(key);
    return normalizeCompleted(saved ? JSON.parse(saved) : []) ?? [];
  }

  function showLocal() {
    const completed = localCompleted();
    for (const box of checkboxes) box.checked = completed.includes(box.value);
  }

  for (const box of checkboxes) {
    box.addEventListener('change', () => {
      const completed = checkboxes.filter(input => input.checked).map(input => input.value);
      try {
        localStorage.setItem(key, JSON.stringify(completed));
        status.textContent = 'Progress saved on this device.';
      } catch {
        status.textContent = 'This browser could not save progress.';
        showLocal();
      }
    });
  }

  for (const button of buttons) {
    button.addEventListener('click', async () => {
      const { action } = button.dataset;
      for (const control of buttons) control.disabled = true;
      status.textContent = '';
      try {
        const body = action === 'save'
          ? { version: SCHEMA_VERSION, completed: localCompleted() }
          : { code: recoverCode.value.trim() };
        const response = await environment.fetch('/progress-backup/v1/' + action, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (response.status === 204) {
          if (newCode.value === body.code) {
            newCode.value = '';
            newBackup.hidden = true;
          }
          status.textContent = 'Backup deleted.';
          return;
        }
        const result = await response.json();
        if (!response.ok) {
          status.textContent = result.error;
          return;
        }
        if (action === 'save') {
          newCode.value = result.code;
          document.querySelector('#expiry').textContent =
            'Expires ' + new Date(result.expiresAt).toLocaleDateString() + '.';
          newBackup.hidden = false;
          status.textContent = 'Backup saved. Keep your recovery code somewhere private.';
        } else if (action === 'restore' && result.version === SCHEMA_VERSION) {
          const backup = normalizeCompleted(result.completed);
          if (!backup?.length) throw new Error('Unexpected backup response');
          // Local progress may have changed while the network request was in flight.
          localStorage.setItem(key, JSON.stringify(mergeCompleted(localCompleted(), backup)));
          showLocal();
          status.textContent = 'Progress restored on this device.';
        } else {
          throw new Error('Unexpected backup response');
        }
      } catch {
        status.textContent = 'Could not complete the backup request.';
      } finally {
        recoverCode.value = '';
        for (const control of buttons) control.disabled = false;
      }
    });
  }

  showLocal();
}

if (typeof window !== 'undefined') activateDemo(window);
